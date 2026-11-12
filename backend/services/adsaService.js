const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Resolves the compiled C++ ADSA engine binary path across Windows and Linux.
 */
function getEnginePath() {
  if (process.env.ADSA_ENGINE_PATH) {
    return path.resolve(process.env.ADSA_ENGINE_PATH);
  }
  const binaryName = process.platform === 'win32' ? 'dukaansaathi_adsa.exe' : 'dukaansaathi_adsa';
  return path.resolve(__dirname, '../../algorithms/build', binaryName);
}

/**
 * Invokes the compiled C++ ADSA engine with a JSON command and payload.
 * @param {string} command - Algorithm command name
 * @param {object} payload - Input data for the algorithm
 * @returns {Promise<object>} Parsed JSON output from the C++ engine
 */
function runADSA(command, payload) {
  return new Promise((resolve, reject) => {
    const enginePath = getEnginePath();
    if (!fs.existsSync(enginePath)) {
      return reject(new Error(`C++ ADSA engine binary not found at ${enginePath}. Build /algorithms first.`));
    }

    const child = spawn(enginePath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to start C++ ADSA engine: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`C++ ADSA engine exited with code ${code}: ${stderr || stdout}`));
      }
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.error) {
          return reject(new Error(parsed.error));
        }
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Invalid JSON from C++ ADSA engine: ${err.message}. Raw: ${stdout}`));
      }
    });

    const inputJson = JSON.stringify({ command, payload });
    child.stdin.write(inputJson);
    child.stdin.end();
  });
}

module.exports = {
  runADSA,
  getEnginePath
};
