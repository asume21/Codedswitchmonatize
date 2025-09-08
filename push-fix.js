import fs from 'fs';
import https from 'https';

// GitHub API configuration
const GITHUB_TOKEN = 'ghp_pat_11AOZTWMA07OnyPpJipe0R_rEPjhxg7gvXJGqloEfKrPQzgGBZzo0MJ8avB8U02k5G5CKITLMDzY3md9ef';
const REPO_OWNER = 'asume21';
const REPO_NAME = 'Codedswitchmonatize';
const FILE_PATH = 'client/src/components/studio/VerticalPianoRoll.tsx';

// Function to make GitHub API requests
function makeGitHubRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: endpoint,
      method: method,
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'Cascade-Push',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (e) {
          resolve(responseData);
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Main function to push the file
async function pushFile() {
  try {
    console.log('🚀 Pushing VerticalPianoRoll.tsx to GitHub...');

    // Read the file content
    const content = fs.readFileSync(FILE_PATH, 'utf8');
    const encodedContent = Buffer.from(content).toString('base64');

    const data = {
      message: 'Fix VerticalPianoRoll syntax error - add missing closing parenthesis',
      content: encodedContent,
      branch: 'main'
    };

    const endpoint = `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const result = await makeGitHubRequest('PUT', endpoint, data);

    console.log('✅ Successfully pushed VerticalPianoRoll.tsx to GitHub!');
    console.log('🔗 Repository: https://github.com/asume21/Codedswitchmonatize');

  } catch (error) {
    console.error('❌ Push failed:', error.message);
    process.exit(1);
  }
}

// Run the push
pushFile();
