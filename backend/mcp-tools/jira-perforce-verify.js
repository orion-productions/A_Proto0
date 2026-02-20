// JIRA-Perforce Verification Tool
// Verifies JIRA task status against Perforce changelists

import jira from './jira.js';
import perforce from './perforce.js';

// Extract keywords from text for matching
const extractKeywords = (text) => {
  if (!text) return [];
  // Remove common words and extract meaningful terms
  const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'];
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 3 && !commonWords.includes(word));
  return [...new Set(words)]; // Remove duplicates
};

// Check if changelist description matches issue content
const matchesIssue = (changelistDescription, issueSummary, issueDescription) => {
  const issueText = `${issueSummary} ${issueDescription}`.toLowerCase();
  const changelistText = changelistDescription.toLowerCase();
  
  // Extract keywords from issue
  const issueKeywords = extractKeywords(issueText);
  
  // Check if changelist contains issue keywords or summary
  const summaryWords = issueSummary.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const matchingKeywords = issueKeywords.filter(keyword => changelistText.includes(keyword));
  const matchingSummaryWords = summaryWords.filter(word => changelistText.includes(word));
  
  // Also check for common "done" indicators
  const doneIndicators = ['done', 'completed', 'finished', 'implemented', 'fixed', 'resolved'];
  const hasDoneIndicator = doneIndicators.some(indicator => changelistText.includes(indicator));
  
  // Match if:
  // 1. At least 2 keywords match, OR
  // 2. At least 2 summary words match, OR
  // 3. At least 1 keyword + done indicator, OR
  // 4. Issue key is mentioned in changelist
  const issueKeyMatch = /(?:SCRUM|PROJ|TASK|BUG)-\d+/i.test(changelistText);
  
  return matchingKeywords.length >= 2 || 
         matchingSummaryWords.length >= 2 || 
         (matchingKeywords.length >= 1 && hasDoneIndicator) ||
         issueKeyMatch;
};

// Main verification function
const verifyJiraTaskStatus = async (issueKey, projectKey = null) => {
  try {
    console.log(`[VERIFY] Starting verification for JIRA issue: ${issueKey}`);
    
    // Step 1: Get JIRA issue details
    const issueResult = await jira.getJiraIssue(issueKey);
    if (issueResult.error) {
      return { error: `Failed to get JIRA issue: ${issueResult.error}` };
    }
    
    const issue = {
      key: issueResult.key,
      summary: issueResult.summary,
      description: issueResult.description || '',
      status: issueResult.status,
      assignee: issueResult.assignee
    };
    
    console.log(`[VERIFY] Issue ${issueKey}: "${issue.summary}" - Status: ${issue.status}`);
    
    // Step 2: Search Perforce changelists
    // Search recent changelists (last 100) to find matches
    // If assignee is known, search their changelists specifically
    let changelists = [];
    
    if (issue.assignee && issue.assignee !== 'Unassigned') {
      // Try to get changelists from the assignee
      console.log(`[VERIFY] Searching changelists from assignee: ${issue.assignee}`);
      const assigneeChangelists = await perforce.listPerforceChangelists(issue.assignee, 100);
      if (!assigneeChangelists.error && assigneeChangelists.changelists) {
        changelists = assigneeChangelists.changelists;
      }
    }
    
    // If no changelists from assignee, search all recent changelists
    if (changelists.length === 0) {
      console.log(`[VERIFY] Searching all recent changelists`);
      const allChangelists = await perforce.listPerforceChangelists(null, 100);
      if (!allChangelists.error && allChangelists.changelists) {
        changelists = allChangelists.changelists;
      }
    }
    
    if (changelists.length === 0) {
      return { 
        error: 'No Perforce changelists found to verify against',
        issue: issue
      };
    }
    
    console.log(`[VERIFY] Found ${changelists.length} changelists to check`);
    
    // Step 3: Check each changelist for matches
    let matchingChangelists = [];
    const issueKeywords = extractKeywords(`${issue.summary} ${issue.description}`);
    
    for (const cl of changelists) {
      const description = cl.description || '';
      if (matchesIssue(description, issue.summary, issue.description)) {
        matchingChangelists.push({
          changelist: cl.changelist,
          description: description,
          user: cl.user,
          date: cl.date,
          status: cl.status
        });
      }
    }
    
    console.log(`[VERIFY] Found ${matchingChangelists.length} matching changelists`);
    
    // Step 4: Determine expected status
    const hasMatchingChangelist = matchingChangelists.length > 0;
    
    // Check if current status matches expected
    // If matching changelist found → status should be "Done" (or "Resolved", "Closed", etc.)
    // If no matching changelist → status should NOT be "Done" (can be "To Do", "In Progress", etc.)
    const isStatusDone = issue.status.toLowerCase().includes('done') ||
                         issue.status.toLowerCase().includes('complete') ||
                         issue.status.toLowerCase().includes('resolved') ||
                         issue.status.toLowerCase().includes('closed');
    
    const statusMatches = hasMatchingChangelist 
      ? isStatusDone  // If changelist found, status should be Done
      : !isStatusDone; // If no changelist, status should NOT be Done (To Do or In Progress is fine)
    
    // Step 5: Prepare result
    const result = {
      issue: issue,
      hasMatchingChangelist: hasMatchingChangelist,
      matchingChangelists: matchingChangelists,
      statusMatches: statusMatches,
      recommendation: statusMatches 
        ? `Status "${issue.status}" appears correct based on Perforce evidence.`
        : hasMatchingChangelist
          ? `Status mismatch detected. Found matching Perforce changelist(s), so status should be "Done" (or "Resolved", "Closed"), but current status is "${issue.status}".`
          : `Status mismatch detected. No matching Perforce changelist found, so status should NOT be "Done" (can be "To Do" or "In Progress"), but current status is "${issue.status}".`
    };
    
    // Step 6: Add comment to JIRA if status doesn't match
    if (!statusMatches) {
      const commentText = `🔍 **Status Verification (Perforce Check)**\n\n` +
        `Checked Perforce changelists for evidence of completion.\n\n` +
        `${hasMatchingChangelist ? '✅' : '❌'} **Result**: ${hasMatchingChangelist ? 'Found' : 'No'} matching changelist(s)\n\n` +
        (hasMatchingChangelist 
          ? `**Matching changelist(s):**\n${matchingChangelists.map(cl => `- CL ${cl.changelist} by ${cl.user} on ${cl.date}: "${cl.description.substring(0, 100)}..."`).join('\n')}\n\n`
          : '') +
        `**Current Status**: ${issue.status}\n\n` +
        `**Recommendation**: ${result.recommendation}`;
      
      console.log(`[VERIFY] Adding comment to JIRA issue ${issueKey}`);
      const commentResult = await jira.addJiraIssueComment(issueKey, commentText);
      
      if (commentResult.error) {
        console.warn(`[VERIFY] Failed to add comment: ${commentResult.error}`);
        result.commentAdded = false;
        result.commentError = commentResult.error;
      } else {
        result.commentAdded = true;
        result.comment = commentResult;
      }
    } else {
      result.commentAdded = false;
      result.commentReason = 'Status matches expected value, no comment needed';
    }
    
    return result;
    
  } catch (error) {
    console.error('[VERIFY] Error during verification:', error);
    return { 
      error: `Verification failed: ${error.message}`,
      stack: error.stack 
    };
  }
};

export default {
  verifyJiraTaskStatus,
  definition: [
    {
      type: 'function',
      function: {
        name: 'verify_jira_task_status',
        description: 'Verify if a JIRA task status is correct by checking Perforce changelists. Gets the JIRA issue details, searches Perforce changelists for mentions of the task, and determines if the status should be "Done" based on whether matching changelists are found. Adds a comment to the JIRA issue if the status is incorrect.',
        parameters: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'The JIRA issue key to verify (e.g., SCRUM-31)',
            },
            projectKey: {
              type: 'string',
              description: 'Optional: The JIRA project key (e.g., SCRUM, UNSEEN). If not provided, will be extracted from issueKey.',
            },
          },
          required: ['issueKey'],
        },
      },
    },
  ],
};
