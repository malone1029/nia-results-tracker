-- Update EE metric names to use verbatim survey question text
-- Source: Northwestern Illinois Association (NIA) Employee Experience Survey
--         Fall 2025 Results Report (Studer Education)
-- Run once in the Supabase SQL Editor

-- ============================================================
-- Q1
-- ============================================================
UPDATE metrics SET name = 'EE Q1 Mean: I feel supported with good processes and the appropriate resources to do my job.'
  WHERE name = 'EE Q1 Mean: Good Processes & Resources';
UPDATE metrics SET name = 'EE Q1 Top Box: I feel supported with good processes and the appropriate resources to do my job.'
  WHERE name = 'EE Q1 Top Box: Good Processes & Resources';

-- ============================================================
-- Q2
-- ============================================================
UPDATE metrics SET name = 'EE Q2 Mean: I receive feedback on my strengths as an employee.'
  WHERE name = 'EE Q2 Mean: Strengths Feedback';
UPDATE metrics SET name = 'EE Q2 Top Box: I receive feedback on my strengths as an employee.'
  WHERE name = 'EE Q2 Top Box: Strengths Feedback';

-- ============================================================
-- Q3
-- ============================================================
UPDATE metrics SET name = 'EE Q3 Mean: I feel supported in balancing my work responsibilities.'
  WHERE name = 'EE Q3 Mean: Work-Life Balance Support';
UPDATE metrics SET name = 'EE Q3 Top Box: I feel supported in balancing my work responsibilities.'
  WHERE name = 'EE Q3 Top Box: Work-Life Balance Support';

-- ============================================================
-- Q4
-- ============================================================
UPDATE metrics SET name = 'EE Q4 Mean: I receive appropriate recognition when I do good work.'
  WHERE name = 'EE Q4 Mean: Recognition';
UPDATE metrics SET name = 'EE Q4 Top Box: I receive appropriate recognition when I do good work.'
  WHERE name = 'EE Q4 Top Box: Recognition';

-- ============================================================
-- Q5
-- ============================================================
UPDATE metrics SET name = 'EE Q5 Mean: I believe that leaders in my immediate work environment are genuinely concerned for my welfare.'
  WHERE name = 'EE Q5 Mean: Leader Concern for Welfare';
UPDATE metrics SET name = 'EE Q5 Top Box: I believe that leaders in my immediate work environment are genuinely concerned for my welfare.'
  WHERE name = 'EE Q5 Top Box: Leader Concern for Welfare';

-- ============================================================
-- Q6
-- ============================================================
UPDATE metrics SET name = 'EE Q6 Mean: I feel that resources in my immediate work environment are allocated to maximize effectiveness.'
  WHERE name = 'EE Q6 Mean: Resource Allocation (Local)';
UPDATE metrics SET name = 'EE Q6 Top Box: I feel that resources in my immediate work environment are allocated to maximize effectiveness.'
  WHERE name = 'EE Q6 Top Box: Resource Allocation (Local)';

-- ============================================================
-- Q7
-- ============================================================
UPDATE metrics SET name = 'EE Q7 Mean: I have the opportunity to provide input on decisions that affect my job.'
  WHERE name = 'EE Q7 Mean: Input on Decisions';
UPDATE metrics SET name = 'EE Q7 Top Box: I have the opportunity to provide input on decisions that affect my job.'
  WHERE name = 'EE Q7 Top Box: Input on Decisions';

-- ============================================================
-- Q8
-- ============================================================
UPDATE metrics SET name = 'EE Q8 Mean: I have a clear understanding of my expectations as an employee.'
  WHERE name = 'EE Q8 Mean: Clear Expectations';
UPDATE metrics SET name = 'EE Q8 Top Box: I have a clear understanding of my expectations as an employee.'
  WHERE name = 'EE Q8 Top Box: Clear Expectations';

-- ============================================================
-- Q9
-- ============================================================
UPDATE metrics SET name = 'EE Q9 Mean: I have the support needed from leadership in my immediate work environment to accomplish my work objectives.'
  WHERE name = 'EE Q9 Mean: Leadership Support';
UPDATE metrics SET name = 'EE Q9 Top Box: I have the support needed from leadership in my immediate work environment to accomplish my work objectives.'
  WHERE name = 'EE Q9 Top Box: Leadership Support';

-- ============================================================
-- Q10
-- ============================================================
UPDATE metrics SET name = 'EE Q10 Mean: I receive feedback concerning areas for improving my performance.'
  WHERE name = 'EE Q10 Mean: Performance Feedback';
UPDATE metrics SET name = 'EE Q10 Top Box: I receive feedback concerning areas for improving my performance.'
  WHERE name = 'EE Q10 Top Box: Performance Feedback';

-- ============================================================
-- Q11
-- ============================================================
UPDATE metrics SET name = 'EE Q11 Mean: I feel that organization-level resources are allocated to maximize effectiveness across the organization.'
  WHERE name = 'EE Q11 Mean: Resource Allocation (Org)';
UPDATE metrics SET name = 'EE Q11 Top Box: I feel that organization-level resources are allocated to maximize effectiveness across the organization.'
  WHERE name = 'EE Q11 Top Box: Resource Allocation (Org)';

-- ============================================================
-- Q12
-- ============================================================
UPDATE metrics SET name = 'EE Q12 Mean: I believe organization-level information is communicated in a timely manner across the organization.'
  WHERE name = 'EE Q12 Mean: Timely Communication (Org)';
UPDATE metrics SET name = 'EE Q12 Top Box: I believe organization-level information is communicated in a timely manner across the organization.'
  WHERE name = 'EE Q12 Top Box: Timely Communication (Org)';

-- ============================================================
-- Q13
-- ============================================================
UPDATE metrics SET name = 'EE Q13 Mean: I see progress being made to create a culture of success for employees across the organization and for those we serve.'
  WHERE name = 'EE Q13 Mean: Culture of Success';
UPDATE metrics SET name = 'EE Q13 Top Box: I see progress being made to create a culture of success for employees across the organization and for those we serve.'
  WHERE name = 'EE Q13 Top Box: Culture of Success';

-- ============================================================
-- Q14
-- ============================================================
UPDATE metrics SET name = 'EE Q14 Mean: I would recommend that parents select my organization to serve their child.'
  WHERE name = 'EE Q14 Mean: Parent Recommendation';
UPDATE metrics SET name = 'EE Q14 Top Box: I would recommend that parents select my organization to serve their child.'
  WHERE name = 'EE Q14 Top Box: Parent Recommendation';

-- ============================================================
-- Q15
-- ============================================================
UPDATE metrics SET name = 'EE Q15 Mean: I feel that others in my organization connect with me in honest two-way communication.'
  WHERE name = 'EE Q15 Mean: Honest Communication';
UPDATE metrics SET name = 'EE Q15 Top Box: I feel that others in my organization connect with me in honest two-way communication.'
  WHERE name = 'EE Q15 Top Box: Honest Communication';

-- ============================================================
-- Q16
-- ============================================================
UPDATE metrics SET name = 'EE Q16 Mean: I work in an organization where employees regularly share and exchange ideas.'
  WHERE name = 'EE Q16 Mean: Share & Exchange Ideas';
UPDATE metrics SET name = 'EE Q16 Top Box: I work in an organization where employees regularly share and exchange ideas.'
  WHERE name = 'EE Q16 Top Box: Share & Exchange Ideas';

-- ============================================================
-- Q17
-- ============================================================
UPDATE metrics SET name = 'EE Q17 Mean: I feel that organizational culture supports open and honest communication.'
  WHERE name = 'EE Q17 Mean: Open Communication Culture';
UPDATE metrics SET name = 'EE Q17 Top Box: I feel that organizational culture supports open and honest communication.'
  WHERE name = 'EE Q17 Top Box: Open Communication Culture';

-- ============================================================
-- Q18
-- ============================================================
UPDATE metrics SET name = 'EE Q18 Mean: I have a clear understanding of the mission and goals of my organization.'
  WHERE name = 'EE Q18 Mean: Mission & Goals Understanding';
UPDATE metrics SET name = 'EE Q18 Top Box: I have a clear understanding of the mission and goals of my organization.'
  WHERE name = 'EE Q18 Top Box: Mission & Goals Understanding';

-- ============================================================
-- Q19
-- ============================================================
UPDATE metrics SET name = 'EE Q19 Mean: I believe my work positively impacts those we serve.'
  WHERE name = 'EE Q19 Mean: Work Positively Impacts';
UPDATE metrics SET name = 'EE Q19 Top Box: I believe my work positively impacts those we serve.'
  WHERE name = 'EE Q19 Top Box: Work Positively Impacts';

-- ============================================================
-- Q20
-- ============================================================
UPDATE metrics SET name = 'EE Q20 Mean: I feel a sense of pride when I tell people where I work.'
  WHERE name = 'EE Q20 Mean: Pride in Organization';
UPDATE metrics SET name = 'EE Q20 Top Box: I feel a sense of pride when I tell people where I work.'
  WHERE name = 'EE Q20 Top Box: Pride in Organization';

-- ============================================================
-- NPS: update description fields with verbatim question text
-- (multiple rows share the same question, so we use description not name)
-- ============================================================
UPDATE metrics SET description = 'Survey question: How likely are you to recommend this organization as a good place to work?'
  WHERE name IN ('EE Org NPS', 'EE Org Promoter %', 'EE Org Passive %', 'EE Org Detractor %');

UPDATE metrics SET description = 'Survey question: How likely are you to recommend your immediate work environment as a good place to work?'
  WHERE name IN ('EE Work Area NPS', 'EE Work Area Promoter %', 'EE Work Area Passive %', 'EE Work Area Detractor %');
