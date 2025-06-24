async function fetchAllSubmissions(updateUICallback) {
  const graphqlUrl = 'https://leetcode.com/graphql';
  const query = `
    query submissionList($offset: Int!, $limit: Int!) {
      submissionList(offset: $offset, limit: $limit) {
        hasNext
        submissions {
          id, title, titleSlug, status, lang, timestamp
        }
      }
    }
  `;

  const limit = 20;
  let offset = 0;
  let allSubmissions = [];
  let hasNext = true;
  let page = 1;

  console.log('📡 Fetching all submissions...');
  updateUICallback('📡 Fetching all submissions...'); // Initial UI update

  while (hasNext) {
    try {
      const res = await fetch(graphqlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { offset, limit } }),
        // 'include' is crucial for sending your LeetCode login cookies
        credentials: 'include' 
      });

      const json = await res.json();
      const pageData = json?.data?.submissionList;

      if (!pageData) {
        console.error('⚠️ Unexpected response:', json);
        updateUICallback('⚠️ Unexpected response format. Check console.');
        break;
      }

      allSubmissions.push(...pageData.submissions);
      hasNext = pageData.hasNext;
      offset += limit;
      
      // Update the UI with progress
      updateUICallback(`📥 Fetched ${allSubmissions.length} submissions... (Page ${page})`);
      page++;

      // Small delay to be kind to the server
      await new Promise(r => setTimeout(r, 200));

    } catch (err) {
        console.error('❌ Error during fetch:', err);
        updateUICallback('❌ Error during fetch. Check console for details.');
        // Re-throw the error to be caught by runAnalysis
        throw err;
    }
  }

  console.log(`🏁 Done. Total submissions fetched: ${allSubmissions.length}`);
  return allSubmissions;
}

async function runAnalysis() {
  const outputElement = document.getElementById('output');
  const updateUI = (message) => {
    outputElement.textContent = message;
  };

  try {
    const submissions = await fetchAllSubmissions(updateUI);
    updateUI('⚙️ Analyzing data...');
    // Give the browser a moment to render the "Analyzing..." message
    await new Promise(r => setTimeout(r, 50));

    const analyzer = new window.LeetCodeAnalyzer(submissions);

    const firstTry = analyzer.getSolvedOnFirstTry();
    const rage = analyzer.getRageQuitProblem();
    const nemesis = analyzer.getNemesisProblem();
    const clockStats = analyzer.getCodingClockStats(); // Capture the return value

    let output = `✅ Solved on first try: ${firstTry.count}\n\n`;
    
    // Display top 5 "first try" problems to keep the popup clean
    firstTry.problems.slice(0, 5).forEach(p => {
      output += `- ${p.title}\n`;
    });
    if (firstTry.problems.length > 5) {
        output += `- ...and ${firstTry.problems.length - 5} more!\n`;
    }
    output += '\n';


    if (rage) {
      output += `💥 Rage Quit: '${rage.title}' (${rage.failCount} failed attempts)\n\n`;
    } else {
      output += `🎉 No Rage Quits found!\n\n`;
    }

    if (nemesis) {
      output += `😤 Nemesis: '${nemesis.title}' (${nemesis.attemptCount} total attempts)\n\n`;
    }
    
    // Find the user's primary coding persona
    const maxLabel = Object.entries(clockStats).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
    output += `🎯 You are primarily a: ${maxLabel}`;


    outputElement.textContent = output;

  } catch (e) {
    outputElement.textContent = "⚠️ Error fetching or analyzing data. See browser console.";
    console.error(e);
  }
}

// THIS IS THE MISSING PIECE:
// It ensures runAnalysis() is called only after the popup HTML is fully loaded.
document.addEventListener('DOMContentLoaded', runAnalysis);