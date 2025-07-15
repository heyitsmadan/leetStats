// src/api/api.ts
import type { RawSubmission, SubmissionListResponse, ProblemMetadata } from '../types';

/**
 * Fetches all submissions from the LeetCode API newer than a given submission ID.
 */
export async function fetchAllSubmissions(
  updateUICallback: (message: string) => void,
  lastSubmissionId: string = '0'
): Promise<RawSubmission[]> {
  const graphqlUrl = 'https://leetcode.com/graphql';
  const query = `
    query submissionList($offset: Int!, $limit: Int!) {
      submissionList(offset: $offset, limit: $limit) {
        hasNext
        submissions { id, title, titleSlug, status, lang, timestamp }
      }
    }
  `;

  const limit = 20;
  let offset = 0;
  let allNewSubmissions: RawSubmission[] = [];
  let hasNext = true;
  let page = 1;

  console.log(`📡 Fetching submissions after ID ${lastSubmissionId}...`);
  updateUICallback('📡 Fetching new submissions...');

  while (hasNext) {
    try {
      const res = await fetch(graphqlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { offset, limit } }),
        credentials: 'include',
      });

      const json: SubmissionListResponse = await res.json();
      const pageData = json?.data?.submissionList;

      if (!pageData) {
        console.error('⚠️ Unexpected response:', json);
        updateUICallback('⚠️ Unexpected response format. Check console.');
        break;
      }

      // Filter submissions that are newer than the last fetched submission ID
      const recentSubmissions = pageData.submissions.filter(
        s => parseInt(s.id, 10) > parseInt(lastSubmissionId, 10)
      );

      allNewSubmissions.push(...recentSubmissions);

      // Stop if we found submissions older than or equal to our last ID
      // or if there are no more pages
      if (recentSubmissions.length < pageData.submissions.length || !pageData.hasNext) {
        hasNext = false;
      } else {
        offset += limit;
      }

      updateUICallback(`📥 Fetched ${allNewSubmissions.length} new submissions... (Page ${page})`);
      page++;
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error('❌ Error during fetch:', err);
      updateUICallback('❌ Error during fetch. Check console for details.');
      throw err;
    }
  }

  console.log(`🏁 Done. Total new submissions fetched: ${allNewSubmissions.length}`);
  return allNewSubmissions;
}

/**
 * Fetches metadata for a single problem if it's not already cached.
 */
export async function fetchProblemMetadata(slug: string): Promise<ProblemMetadata | null> {
  const graphqlUrl = 'https://leetcode.com/graphql';
  const query = `
    query getQuestionMetadata($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        titleSlug, difficulty, topicTags { name, slug }
      }
    }
  `;

  try {
    const res = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { titleSlug: slug } }),
      credentials: 'include',
    });

    const json = await res.json();
    const question = json?.data?.question;

    if (!question) {
      console.warn(`❌ No metadata found for problem slug: ${slug}`);
      return null;
    }

    return {
      slug: question.titleSlug,
      difficulty: question.difficulty,
      topics: question.topicTags.map((tag: { slug: string }) => tag.slug),
    };
  } catch (err) {
    console.error(`❌ Error fetching metadata for ${slug}:`, err);
    return null;
  }
}
