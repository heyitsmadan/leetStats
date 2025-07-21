// src/core/api.ts
import type {
  RawSubmission,
  SubmissionListResponse,
  ProblemMetadata,
  UserSubmissionsGraphQLResponse,
} from '../types';

/**
 * Defines the structure of the user status response from LeetCode's API.
 */
export interface UserStatus {
  isSignedIn: boolean;
  username: string;
  isPremium?: boolean;
}

/**
 * Fetches the login status and username of the current user.
 * @returns A promise that resolves to the user's status.
 */
export async function fetchUserStatus(): Promise<UserStatus> {
  const graphqlUrl = 'https://leetcode.com/graphql';
  const query = `
    query {
      userStatus {
        isSignedIn
        username
      }
    }`;

  try {
    const res = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      credentials: 'include',
    });

    const json = await res.json();
    // If userStatus is null (can happen if cookies are invalid/expired), treat as logged out.
    if (!json.data.userStatus) {
      return { isSignedIn: false, username: '' };
    }
    return json.data.userStatus;
  } catch (err) {
    console.error('❌ Error fetching user status:', err);
    // Return a fallback value indicating the user is not signed in.
    return { isSignedIn: false, username: '' };
  }
}


/**
 * Fetches the total number of accepted submissions for a user using the specified GraphQL query.
 * @param username The LeetCode username.
 * @returns The total number of accepted submissions.
 */
export async function fetchTotalAcceptedSubmissions(username: string): Promise<number> {
  const graphqlUrl = 'https://leetcode.com/graphql';
  const query = `
    query userSubmissions($username: String!) {
      matchedUser(username: $username) {
        submitStatsGlobal {
          acSubmissionNum {
            difficulty
            submissions
          }
        }
      }
    }
  `;

  try {
    const res = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { username } }),
      credentials: 'include',
    });

    const json: UserSubmissionsGraphQLResponse = await res.json();
    const allStats = json.data.matchedUser.submitStatsGlobal.acSubmissionNum.find(
      s => s.difficulty === 'All'
    );

    return allStats ? allStats.submissions : 0;
  } catch (err) {
    console.error('❌ Error fetching total accepted submissions:', err);
    return 0; // Return a fallback value
  }
}

/**
 * Fetches all submissions from the LeetCode API newer than a given submission ID.
 * @param lastSubmissionId The ID of the last submission fetched previously.
 * @param onProgress A callback function to report progress.
 * @returns A promise that resolves to an array of new raw submissions.
 */
export async function fetchAllSubmissions(
  lastSubmissionId: string = '0',
  onProgress: (progress: { accepted: number; total: number }) => void
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
  let newAcceptedFetched = 0;

  console.log(`📡 Fetching submissions after ID ${lastSubmissionId}...`);

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
        break;
      }

      const recentSubmissions = pageData.submissions.filter(
        s => parseInt(s.id, 10) > parseInt(lastSubmissionId, 10)
      );

      allNewSubmissions.push(...recentSubmissions);
      
      const acceptedThisPage = recentSubmissions.filter(s => s.status === 10).length;
      newAcceptedFetched += acceptedThisPage;
      
      // Report running total of *new* accepted and *new* total submissions
      onProgress({ accepted: newAcceptedFetched, total: allNewSubmissions.length });

      if (recentSubmissions.length < pageData.submissions.length || !pageData.hasNext) {
        hasNext = false;
      } else {
        offset += limit;
      }

      await new Promise(r => setTimeout(r, 200)); // Avoid rate-limiting
    } catch (err) {
      console.error('❌ Error during fetch:', err);
      throw err; // Re-throw to be caught by the main initializer
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
      topics: question.topicTags.map((tag: { slug: 'string' }) => tag.slug),
    };
  } catch (err) {
    console.error(`❌ Error fetching metadata for ${slug}:`, err);
    return null;
  }
}
