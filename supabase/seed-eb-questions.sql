-- Seed: Excellence Builder Questions
-- 2023-2024 Baldrige Excellence Builder (all sectors)
-- Run in Supabase SQL Editor AFTER migration-018-eb-tier.
-- 99 questions across all 19 items, tier = 'excellence_builder'.
-- Uses EB- prefix on question_code to avoid conflicts with full framework codes.

-- ============================================================
-- P.1 Organizational Description
-- ============================================================
INSERT INTO baldrige_questions (item_id, question_code, area_label, question_text, question_type, tier, sort_order) VALUES

-- P.1a Organizational Environment
((SELECT id FROM baldrige_items WHERE item_code='P.1'), 'EB-P.1a(1)', 'Organizational Environment',
 'What are your main products and/or services? What is the relative importance (including percentage of revenue/budget) of each product or service to your success? What are the delivery methods for these products and/or services?',
 'context', 'excellence_builder', 201),

((SELECT id FROM baldrige_items WHERE item_code='P.1'), 'EB-P.1a(2)', 'Organizational Environment',
 'What are your mission, vision, and values? What are the defining characteristics of your organizational culture? What are your organization''s core competencies, and what is their relationship to your mission and vision?',
 'context', 'excellence_builder', 202),

((SELECT id FROM baldrige_items WHERE item_code='P.1'), 'EB-P.1a(3)', 'Organizational Environment',
 'What is your workforce profile? What are your workforce or employee groups and segments and the key engagement drivers for each? What key changes are you experiencing in your workforce capability, capacity, and composition?',
 'context', 'excellence_builder', 203),

((SELECT id FROM baldrige_items WHERE item_code='P.1'), 'EB-P.1a(4)', 'Organizational Environment',
 'What are your major assets, such as facilities, equipment, technologies, and intellectual property?',
 'context', 'excellence_builder', 204),

((SELECT id FROM baldrige_items WHERE item_code='P.1'), 'EB-P.1a(5)', 'Organizational Environment',
 'What are your key applicable regulations, and accreditation, certification, or registration requirements?',
 'context', 'excellence_builder', 205),

-- P.1b Organizational Relationships
((SELECT id FROM baldrige_items WHERE item_code='P.1'), 'EB-P.1b(1)', 'Organizational Relationships',
 'What are your organizational leadership and governance structures? What are the key components of your organization''s leadership system? What are the reporting relationships among your governance system, senior leaders, and parent organization, as appropriate?',
 'context', 'excellence_builder', 206),

((SELECT id FROM baldrige_items WHERE item_code='P.1'), 'EB-P.1b(2)', 'Organizational Relationships',
 'What are your key market segments, customer groups, and stakeholder groups, as appropriate? What are their key requirements and expectations for your products and/or services, customer support services, and operations, including any differences among the groups?',
 'context', 'excellence_builder', 207),

((SELECT id FROM baldrige_items WHERE item_code='P.1'), 'EB-P.1b(3)', 'Organizational Relationships',
 'What are your key types of suppliers, partners, and collaborators? What role do they play in producing and delivering your key products and/or services and customer support services? What role do they play in contributing and implementing innovations in your organization? What are your key supply-network requirements?',
 'context', 'excellence_builder', 208),

-- ============================================================
-- P.2 Organizational Situation
-- ============================================================

-- P.2a Competitive Environment
((SELECT id FROM baldrige_items WHERE item_code='P.2'), 'EB-P.2a(1)', 'Competitive Environment',
 'What are your size, share, and growth in your industry or the markets you serve? How many and what types of competitors do you have? What differentiates you from them?',
 'context', 'excellence_builder', 209),

((SELECT id FROM baldrige_items WHERE item_code='P.2'), 'EB-P.2a(2)', 'Competitive Environment',
 'What key changes, if any, are affecting your competitive situation, including changes that create opportunities for collaboration and innovation, as appropriate?',
 'context', 'excellence_builder', 210),

((SELECT id FROM baldrige_items WHERE item_code='P.2'), 'EB-P.2a(3)', 'Competitive Environment',
 'What key sources of comparative and competitive data are available from within your industry? What key sources of comparative data are available from outside your industry? What limitations, if any, affect your ability to obtain or use these data?',
 'context', 'excellence_builder', 211),

-- P.2b Strategic Context
((SELECT id FROM baldrige_items WHERE item_code='P.2'), 'EB-P.2b', 'Strategic Context',
 'What are your key strategic challenges, threats, advantages, and opportunities?',
 'context', 'excellence_builder', 212),

-- P.2c Performance Improvement System
((SELECT id FROM baldrige_items WHERE item_code='P.2'), 'EB-P.2c', 'Performance Improvement System',
 'What is your overall system for performance improvement? What key tools and methods are used as part of this system?',
 'context', 'excellence_builder', 213),

-- ============================================================
-- 1.1 Senior Leadership
-- ============================================================
((SELECT id FROM baldrige_items WHERE item_code='1.1'), 'EB-1.1(1)', 'Senior Leadership',
 'How do senior leaders set and deploy your organization''s mission, vision, and values?',
 'process', 'excellence_builder', 214),

((SELECT id FROM baldrige_items WHERE item_code='1.1'), 'EB-1.1(2)', 'Senior Leadership',
 'How do senior leaders'' personal actions demonstrate their commitment to legal and ethical behavior?',
 'process', 'excellence_builder', 215),

((SELECT id FROM baldrige_items WHERE item_code='1.1'), 'EB-1.1(3)', 'Senior Leadership',
 'How do senior leaders communicate with and engage the entire workforce, key partners, and key customers?',
 'process', 'excellence_builder', 216),

((SELECT id FROM baldrige_items WHERE item_code='1.1'), 'EB-1.1(4)', 'Senior Leadership',
 'How do senior leaders create an environment for success now and in the future?',
 'process', 'excellence_builder', 217),

((SELECT id FROM baldrige_items WHERE item_code='1.1'), 'EB-1.1(5)', 'Senior Leadership',
 'How do senior leaders create a focus on action to achieve the organization''s mission and vision?',
 'process', 'excellence_builder', 218),

-- ============================================================
-- 1.2 Governance and Societal Contributions
-- ============================================================
((SELECT id FROM baldrige_items WHERE item_code='1.2'), 'EB-1.2(1)', 'Governance and Societal Contributions',
 'How does your organization ensure responsible governance?',
 'process', 'excellence_builder', 219),

((SELECT id FROM baldrige_items WHERE item_code='1.2'), 'EB-1.2(2)', 'Governance and Societal Contributions',
 'How do you evaluate the performance of your senior leaders and your governance system?',
 'process', 'excellence_builder', 220),

((SELECT id FROM baldrige_items WHERE item_code='1.2'), 'EB-1.2(3)', 'Governance and Societal Contributions',
 'How does your governance system review the organization''s performance?',
 'process', 'excellence_builder', 221),

((SELECT id FROM baldrige_items WHERE item_code='1.2'), 'EB-1.2(4)', 'Governance and Societal Contributions',
 'How do you address current and anticipated future legal, regulatory, and community concerns with your products and/or services, and operations?',
 'process', 'excellence_builder', 222),

((SELECT id FROM baldrige_items WHERE item_code='1.2'), 'EB-1.2(5)', 'Governance and Societal Contributions',
 'How do you require and foster ethical behavior in all interactions?',
 'process', 'excellence_builder', 223),

((SELECT id FROM baldrige_items WHERE item_code='1.2'), 'EB-1.2(6)', 'Governance and Societal Contributions',
 'How do you incorporate societal well-being and benefit into your strategy and daily operations?',
 'process', 'excellence_builder', 224),

((SELECT id FROM baldrige_items WHERE item_code='1.2'), 'EB-1.2(7)', 'Governance and Societal Contributions',
 'How do you actively support and strengthen your key communities?',
 'process', 'excellence_builder', 225),

-- ============================================================
-- 2.1 Strategy Development
-- ============================================================
((SELECT id FROM baldrige_items WHERE item_code='2.1'), 'EB-2.1(1)', 'Strategy Development',
 'How do you conduct your strategic planning?',
 'process', 'excellence_builder', 226),

((SELECT id FROM baldrige_items WHERE item_code='2.1'), 'EB-2.1(2)', 'Strategy Development',
 'How do you collect and analyze relevant data and develop information for use in your strategic planning process?',
 'process', 'excellence_builder', 227),

((SELECT id FROM baldrige_items WHERE item_code='2.1'), 'EB-2.1(3)', 'Strategy Development',
 'How do you identify strategic opportunities and stimulate innovation?',
 'process', 'excellence_builder', 228),

((SELECT id FROM baldrige_items WHERE item_code='2.1'), 'EB-2.1(4)', 'Strategy Development',
 'How do you decide which key processes will be accomplished by your workforce and which by external suppliers, partners, and collaborators?',
 'process', 'excellence_builder', 229),

((SELECT id FROM baldrige_items WHERE item_code='2.1'), 'EB-2.1(5)', 'Strategy Development',
 'What are your organization''s key strategic objectives and their most important related goals?',
 'process', 'excellence_builder', 230),

((SELECT id FROM baldrige_items WHERE item_code='2.1'), 'EB-2.1(6)', 'Strategy Development',
 'How do your strategic objectives achieve balance among varying and competing organizational needs?',
 'process', 'excellence_builder', 231),

-- ============================================================
-- 2.2 Strategy Implementation
-- ============================================================
((SELECT id FROM baldrige_items WHERE item_code='2.2'), 'EB-2.2(1)', 'Strategy Implementation',
 'How do you develop your action plans?',
 'process', 'excellence_builder', 232),

((SELECT id FROM baldrige_items WHERE item_code='2.2'), 'EB-2.2(2)', 'Strategy Implementation',
 'How do you deploy your action plans?',
 'process', 'excellence_builder', 233),

((SELECT id FROM baldrige_items WHERE item_code='2.2'), 'EB-2.2(3)', 'Strategy Implementation',
 'How do you ensure that financial and other resources are available to support the achievement of your action plans while you meet current obligations?',
 'process', 'excellence_builder', 234),

((SELECT id FROM baldrige_items WHERE item_code='2.2'), 'EB-2.2(4)', 'Strategy Implementation',
 'What are your key workforce plans to support your strategic objectives and action plans?',
 'process', 'excellence_builder', 235),

((SELECT id FROM baldrige_items WHERE item_code='2.2'), 'EB-2.2(5)', 'Strategy Implementation',
 'What key performance measures or indicators do you use to track the achievement and effectiveness of your action plans?',
 'process', 'excellence_builder', 236),

((SELECT id FROM baldrige_items WHERE item_code='2.2'), 'EB-2.2(6)', 'Strategy Implementation',
 'For these key performance measures or indicators, what are your performance projections for your short- and longer-term planning horizons?',
 'process', 'excellence_builder', 237),

((SELECT id FROM baldrige_items WHERE item_code='2.2'), 'EB-2.2(7)', 'Strategy Implementation',
 'How do you recognize and respond when circumstances require a shift in action plans and rapid execution of new plans?',
 'process', 'excellence_builder', 238),

-- ============================================================
-- 3.1 Customer Expectations
-- ============================================================
((SELECT id FROM baldrige_items WHERE item_code='3.1'), 'EB-3.1(1)', 'Customer Expectations',
 'How do you listen to, interact with, and observe customers to obtain actionable information?',
 'process', 'excellence_builder', 239),

((SELECT id FROM baldrige_items WHERE item_code='3.1'), 'EB-3.1(2)', 'Customer Expectations',
 'How do you listen to potential customers to obtain actionable data and information?',
 'process', 'excellence_builder', 240),

((SELECT id FROM baldrige_items WHERE item_code='3.1'), 'EB-3.1(3)', 'Customer Expectations',
 'How do you determine your customer groups and market segments?',
 'process', 'excellence_builder', 241),

((SELECT id FROM baldrige_items WHERE item_code='3.1'), 'EB-3.1(4)', 'Customer Expectations',
 'How do you determine product and/or service offerings?',
 'process', 'excellence_builder', 242),

-- ============================================================
-- 3.2 Customer Engagement
-- ============================================================
((SELECT id FROM baldrige_items WHERE item_code='3.2'), 'EB-3.2(1)', 'Customer Engagement',
 'How do you acquire and retain customers by building and managing relationships?',
 'process', 'excellence_builder', 243),

((SELECT id FROM baldrige_items WHERE item_code='3.2'), 'EB-3.2(2)', 'Customer Engagement',
 'How do you enable customers to do business with you, seek information, and obtain support?',
 'process', 'excellence_builder', 244),

((SELECT id FROM baldrige_items WHERE item_code='3.2'), 'EB-3.2(3)', 'Customer Engagement',
 'How do you manage customer complaints?',
 'process', 'excellence_builder', 245),

((SELECT id FROM baldrige_items WHERE item_code='3.2'), 'EB-3.2(4)', 'Customer Engagement',
 'How do your customer experience processes promote and ensure fair treatment for different customers, customer groups, and market segments?',
 'process', 'excellence_builder', 246),

((SELECT id FROM baldrige_items WHERE item_code='3.2'), 'EB-3.2(5)', 'Customer Engagement',
 'How do you determine customer satisfaction, dissatisfaction, and engagement?',
 'process', 'excellence_builder', 247),

-- ============================================================
-- 4.1 Measurement, Analysis, Review, and Improvement
-- ============================================================
((SELECT id FROM baldrige_items WHERE item_code='4.1'), 'EB-4.1(1)', 'Measurement, Analysis, and Improvement',
 'How do you track data and information on daily operations and overall organizational performance?',
 'process', 'excellence_builder', 248),

((SELECT id FROM baldrige_items WHERE item_code='4.1'), 'EB-4.1(2)', 'Measurement, Analysis, and Improvement',
 'How do you select comparative data and information to support fact-based decision making?',
 'process', 'excellence_builder', 249),

((SELECT id FROM baldrige_items WHERE item_code='4.1'), 'EB-4.1(3)', 'Measurement, Analysis, and Improvement',
 'How do you analyze and review your organization''s performance and capabilities?',
 'process', 'excellence_builder', 250),

((SELECT id FROM baldrige_items WHERE item_code='4.1'), 'EB-4.1(4)', 'Measurement, Analysis, and Improvement',
 'How do you use the findings from your performance reviews to develop priorities for continuous improvement and opportunities for innovation?',
 'process', 'excellence_builder', 251),

-- ============================================================
-- 4.2 Information and Knowledge Management
-- ============================================================
((SELECT id FROM baldrige_items WHERE item_code='4.2'), 'EB-4.2(1)', 'Information and Knowledge Management',
 'How do you verify and ensure the quality of organizational data and information?',
 'process', 'excellence_builder', 252),

((SELECT id FROM baldrige_items WHERE item_code='4.2'), 'EB-4.2(2)', 'Information and Knowledge Management',
 'How do you ensure the availability of organizational data and information?',
 'process', 'excellence_builder', 253),

((SELECT id FROM baldrige_items WHERE item_code='4.2'), 'EB-4.2(3)', 'Information and Knowledge Management',
 'How do you secure sensitive or privileged data and information, information technology assets, and Internet-enabled systems?',
 'process', 'excellence_builder', 254),

((SELECT id FROM baldrige_items WHERE item_code='4.2'), 'EB-4.2(4)', 'Information and Knowledge Management',
 'How do you build and manage organizational knowledge?',
 'process', 'excellence_builder', 255),

((SELECT id FROM baldrige_items WHERE item_code='4.2'), 'EB-4.2(5)', 'Information and Knowledge Management',
 'How do you identify and share best practices in your organization?',
 'process', 'excellence_builder', 256),

((SELECT id FROM baldrige_items WHERE item_code='4.2'), 'EB-4.2(6)', 'Information and Knowledge Management',
 'How do you determine which opportunities for innovation to pursue?',
 'process', 'excellence_builder', 257),

-- ============================================================
-- 5.1 Workforce Environment
-- ============================================================
((SELECT id FROM baldrige_items WHERE item_code='5.1'), 'EB-5.1(1)', 'Workforce Environment',
 'How do you assess your workforce capability and capacity needs?',
 'process', 'excellence_builder', 258),

((SELECT id FROM baldrige_items WHERE item_code='5.1'), 'EB-5.1(2)', 'Workforce Environment',
 'How do you recruit, hire, and onboard new workforce members?',
 'process', 'excellence_builder', 259),

((SELECT id FROM baldrige_items WHERE item_code='5.1'), 'EB-5.1(3)', 'Workforce Environment',
 'How do you prepare your workforce for changing capability and capacity needs?',
 'process', 'excellence_builder', 260),

((SELECT id FROM baldrige_items WHERE item_code='5.1'), 'EB-5.1(4)', 'Workforce Environment',
 'How do you organize and manage your workforce?',
 'process', 'excellence_builder', 261),

((SELECT id FROM baldrige_items WHERE item_code='5.1'), 'EB-5.1(5)', 'Workforce Environment',
 'How do you address workplace health and accessibility for the workforce?',
 'process', 'excellence_builder', 262),

((SELECT id FROM baldrige_items WHERE item_code='5.1'), 'EB-5.1(6)', 'Workforce Environment',
 'How do you support your workforce via compensation and benefits?',
 'process', 'excellence_builder', 263),

-- ============================================================
-- 5.2 Workforce Engagement
-- ============================================================
((SELECT id FROM baldrige_items WHERE item_code='5.2'), 'EB-5.2(1)', 'Workforce Engagement',
 'How do you determine the key drivers of workforce engagement?',
 'process', 'excellence_builder', 264),

((SELECT id FROM baldrige_items WHERE item_code='5.2'), 'EB-5.2(2)', 'Workforce Engagement',
 'How do you assess workforce engagement?',
 'process', 'excellence_builder', 265),

((SELECT id FROM baldrige_items WHERE item_code='5.2'), 'EB-5.2(3)', 'Workforce Engagement',
 'How do you foster an organizational culture that is characterized by open communication, high performance, and an engaged workforce?',
 'process', 'excellence_builder', 266),

((SELECT id FROM baldrige_items WHERE item_code='5.2'), 'EB-5.2(4)', 'Workforce Engagement',
 'How does your workforce performance management system support high performance?',
 'process', 'excellence_builder', 267),

((SELECT id FROM baldrige_items WHERE item_code='5.2'), 'EB-5.2(5)', 'Workforce Engagement',
 'How does your learning and development system support the personal development of workforce members and your organization''s needs?',
 'process', 'excellence_builder', 268),

((SELECT id FROM baldrige_items WHERE item_code='5.2'), 'EB-5.2(6)', 'Workforce Engagement',
 'How do you manage career development for your workforce and your future leaders?',
 'process', 'excellence_builder', 269),

((SELECT id FROM baldrige_items WHERE item_code='5.2'), 'EB-5.2(7)', 'Workforce Engagement',
 'How do you ensure that your performance management, performance development, and career development processes promote equity and inclusion for a diverse workforce and different workforce groups and segments?',
 'process', 'excellence_builder', 270),

-- ============================================================
-- 6.1 Work Processes
-- ============================================================
((SELECT id FROM baldrige_items WHERE item_code='6.1'), 'EB-6.1(1)', 'Work Processes',
 'How do you determine your key product and/or service requirements?',
 'process', 'excellence_builder', 271),

((SELECT id FROM baldrige_items WHERE item_code='6.1'), 'EB-6.1(2)', 'Work Processes',
 'How do you design your products and/or services to meet these key requirements?',
 'process', 'excellence_builder', 272),

((SELECT id FROM baldrige_items WHERE item_code='6.1'), 'EB-6.1(3)', 'Work Processes',
 'How do you determine your key work process and support process requirements?',
 'process', 'excellence_builder', 273),

((SELECT id FROM baldrige_items WHERE item_code='6.1'), 'EB-6.1(4)', 'Work Processes',
 'How do you design your key work processes and support processes to meet your key requirements?',
 'process', 'excellence_builder', 274),

((SELECT id FROM baldrige_items WHERE item_code='6.1'), 'EB-6.1(5)', 'Work Processes',
 'How does your day-to-day operation of your key work processes and support processes ensure that they meet your key process requirements?',
 'process', 'excellence_builder', 275),

((SELECT id FROM baldrige_items WHERE item_code='6.1'), 'EB-6.1(6)', 'Work Processes',
 'How do you improve your key work processes and support processes to improve product and/or service and process performance?',
 'process', 'excellence_builder', 276),

-- ============================================================
-- 6.2 Operational Effectiveness
-- ============================================================
((SELECT id FROM baldrige_items WHERE item_code='6.2'), 'EB-6.2(1)', 'Operational Effectiveness',
 'How do you manage the cost, efficiency, and effectiveness of your operations?',
 'process', 'excellence_builder', 277),

((SELECT id FROM baldrige_items WHERE item_code='6.2'), 'EB-6.2(2)', 'Operational Effectiveness',
 'How do you manage your supply network?',
 'process', 'excellence_builder', 278),

((SELECT id FROM baldrige_items WHERE item_code='6.2'), 'EB-6.2(3)', 'Operational Effectiveness',
 'How do you provide a safe operating environment for your workforce and other people in your workplace?',
 'process', 'excellence_builder', 279),

((SELECT id FROM baldrige_items WHERE item_code='6.2'), 'EB-6.2(4)', 'Operational Effectiveness',
 'How do you ensure that your organization can anticipate, prepare for, and recover from disasters, emergencies, and other disruptions?',
 'process', 'excellence_builder', 280),

((SELECT id FROM baldrige_items WHERE item_code='6.2'), 'EB-6.2(5)', 'Operational Effectiveness',
 'What is your organization''s overall approach to risk management?',
 'process', 'excellence_builder', 281),

-- ============================================================
-- 7.1 Product and Process Results
-- ============================================================
((SELECT id FROM baldrige_items WHERE item_code='7.1'), 'EB-7.1(1)', 'Product and Process Results',
 'What are your results for your products and/or services?',
 'results', 'excellence_builder', 282),

((SELECT id FROM baldrige_items WHERE item_code='7.1'), 'EB-7.1(2)', 'Product and Process Results',
 'What are your process effectiveness and efficiency results?',
 'results', 'excellence_builder', 283),

((SELECT id FROM baldrige_items WHERE item_code='7.1'), 'EB-7.1(3)', 'Product and Process Results',
 'What are your safety and emergency preparedness results?',
 'results', 'excellence_builder', 284),

((SELECT id FROM baldrige_items WHERE item_code='7.1'), 'EB-7.1(4)', 'Product and Process Results',
 'What are your supply-network management results?',
 'results', 'excellence_builder', 285),

-- ============================================================
-- 7.2 Customer Results
-- ============================================================
((SELECT id FROM baldrige_items WHERE item_code='7.2'), 'EB-7.2(1)', 'Customer Results',
 'What are your customer satisfaction and dissatisfaction results?',
 'results', 'excellence_builder', 286),

((SELECT id FROM baldrige_items WHERE item_code='7.2'), 'EB-7.2(2)', 'Customer Results',
 'What are your customer engagement results?',
 'results', 'excellence_builder', 287),

-- ============================================================
-- 7.3 Workforce Results
-- ============================================================
((SELECT id FROM baldrige_items WHERE item_code='7.3'), 'EB-7.3(1)', 'Workforce Results',
 'What are your workforce capability and capacity results?',
 'results', 'excellence_builder', 288),

((SELECT id FROM baldrige_items WHERE item_code='7.3'), 'EB-7.3(2)', 'Workforce Results',
 'What are your results for workplace health and for workforce compensation and benefits?',
 'results', 'excellence_builder', 289),

((SELECT id FROM baldrige_items WHERE item_code='7.3'), 'EB-7.3(3)', 'Workforce Results',
 'What are your workforce engagement results?',
 'results', 'excellence_builder', 290),

((SELECT id FROM baldrige_items WHERE item_code='7.3'), 'EB-7.3(4)', 'Workforce Results',
 'What are your workforce and leader development results?',
 'results', 'excellence_builder', 291),

-- ============================================================
-- 7.4 Leadership and Governance Results
-- ============================================================
((SELECT id FROM baldrige_items WHERE item_code='7.4'), 'EB-7.4(1)', 'Leadership and Governance Results',
 'What are your results for senior leaders'' communication and engagement with the workforce, partners, and customers?',
 'results', 'excellence_builder', 292),

((SELECT id FROM baldrige_items WHERE item_code='7.4'), 'EB-7.4(2)', 'Leadership and Governance Results',
 'What are your results for governance accountability?',
 'results', 'excellence_builder', 293),

((SELECT id FROM baldrige_items WHERE item_code='7.4'), 'EB-7.4(3)', 'Leadership and Governance Results',
 'What are your legal and regulatory results?',
 'results', 'excellence_builder', 294),

((SELECT id FROM baldrige_items WHERE item_code='7.4'), 'EB-7.4(4)', 'Leadership and Governance Results',
 'What are your results for ethical behavior?',
 'results', 'excellence_builder', 295),

((SELECT id FROM baldrige_items WHERE item_code='7.4'), 'EB-7.4(5)', 'Leadership and Governance Results',
 'What are your results for societal well-being and support of your key communities?',
 'results', 'excellence_builder', 296),

-- ============================================================
-- 7.5 Financial, Marketplace, and Strategy Results
-- ============================================================
((SELECT id FROM baldrige_items WHERE item_code='7.5'), 'EB-7.5(1)', 'Financial, Marketplace, and Strategy Results',
 'What are your financial performance results?',
 'results', 'excellence_builder', 297),

((SELECT id FROM baldrige_items WHERE item_code='7.5'), 'EB-7.5(2)', 'Financial, Marketplace, and Strategy Results',
 'What are your marketplace performance results?',
 'results', 'excellence_builder', 298),

((SELECT id FROM baldrige_items WHERE item_code='7.5'), 'EB-7.5(3)', 'Financial, Marketplace, and Strategy Results',
 'What are your results for the achievement of your organizational strategy?',
 'results', 'excellence_builder', 299)

ON CONFLICT (question_code) DO NOTHING;
