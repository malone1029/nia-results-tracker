import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getAsanaToken, asanaFetch } from '@/lib/asana';
import { fetchProjectSections, findAdliTasks } from '@/lib/asana-helpers';

/**
 * POST /api/asana/resync
 * Full content sync from Asana:
 * 1. Saves current asana_raw_data → asana_raw_data_previous (for AI snapshot comparison)
 * 2. Fetches fresh data from Asana (sections, tasks, subtasks)
 * 3. Updates charter from Asana project notes
 * 4. Updates ADLI fields from [ADLI: ...] task descriptions
 * 5. Sets guided_step = 'charter' to restart the improvement cycle (charter needs review first)
 *
 * Body: { processId: number }
 */
export async function POST(request: Request) {
  const { processId } = await request.json();

  if (!processId) {
    return NextResponse.json({ error: 'processId is required' }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const token = await getAsanaToken(user.id);
  if (!token) {
    return NextResponse.json(
      { error: 'not_connected', message: 'Asana not connected. Go to Settings to connect.' },
      { status: 401 }
    );
  }

  // Fetch the full process (need current raw data for snapshot + charter for comparison)
  const { data: proc, error: procError } = await supabase
    .from('processes')
    .select('*')
    .eq('id', processId)
    .single();

  if (procError || !proc) {
    return NextResponse.json({ error: 'Process not found' }, { status: 404 });
  }

  if (!proc.asana_project_gid) {
    return NextResponse.json(
      { error: 'not_linked', message: 'This process is not linked to an Asana project.' },
      { status: 400 }
    );
  }

  const projectGid = proc.asana_project_gid;

  try {
    // Fetch project details (notes = charter content)
    const project = await asanaFetch(
      token,
      `/projects/${projectGid}?opt_fields=name,notes,html_notes,owner.name,due_on,start_on,members.name`
    );

    // Fetch all sections and tasks using shared helper
    const sectionData = await fetchProjectSections(token, projectGid);

    // Build updated raw data
    const asanaRawData = {
      project: project.data,
      sections: sectionData,
      fetched_at: new Date().toISOString(),
    };

    // Count for summary
    let totalTasks = 0;
    let totalSubtasks = 0;
    for (const section of sectionData) {
      totalTasks += section.tasks.length;
      for (const task of section.tasks) {
        totalSubtasks += task.subtasks.length;
      }
    }

    // Find ADLI documentation tasks
    const adliTasks = findAdliTasks(sectionData);

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      // Snapshot: save current raw data as previous
      asana_raw_data_previous: proc.asana_raw_data || null,
      // Fresh data
      asana_raw_data: asanaRawData,
      // Restart guided flow at charter review (not assessment — charter needs review first)
      guided_step: 'charter',
      updated_at: new Date().toISOString(),
    };

    // Update charter from Asana project notes
    const projectNotes = project.data.notes || '';
    if (projectNotes) {
      const existingCharter = (proc.charter as Record<string, unknown>) || {};
      updatePayload.charter = {
        ...existingCharter,
        content: projectNotes,
        purpose: projectNotes,
      };
    }

    // Update ADLI fields from [ADLI: ...] task descriptions
    const adliTaskGids: Record<string, string> = {};
    for (const [dimension, taskInfo] of Object.entries(adliTasks)) {
      adliTaskGids[dimension] = taskInfo.gid;
      if (taskInfo.notes.trim()) {
        const fieldKey = `adli_${dimension}`;
        const existingData = (proc[fieldKey] as Record<string, unknown>) || {};
        updatePayload[fieldKey] = {
          ...existingData,
          content: taskInfo.notes,
        };
      }
    }
    updatePayload.asana_adli_task_gids = adliTaskGids;

    // Perform the update
    const { error: updateError } = await supabase
      .from('processes')
      .update(updatePayload)
      .eq('id', processId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Log in history
    const adliCount = Object.keys(adliTasks).length;
    await supabase.from('process_history').insert({
      process_id: processId,
      change_description: `Synced from Asana (${totalTasks} tasks, ${totalSubtasks} subtasks, ${adliCount} ADLI docs) by ${user.email}`,
    });

    return NextResponse.json({
      success: true,
      sections: sectionData.length,
      tasks: totalTasks,
      subtasks: totalSubtasks,
      adliFound: adliCount,
    });
  } catch (err) {
    const errMsg = (err as Error).message || '';
    if (
      errMsg.includes('Unknown object') ||
      errMsg.includes('Not Found') ||
      errMsg.includes('404')
    ) {
      return NextResponse.json(
        { error: 'not_linked', message: 'The linked Asana project no longer exists.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
