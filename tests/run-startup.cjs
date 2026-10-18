const {spawn} = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const env = {...process.env};
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;
const run = args => new Promise((resolve, reject) => {
  const resultPath = path.join(__dirname, '..', '.runtime', args.includes('--cancel') ? 'startup-cancel-result.json' : 'startup-result.json');
  fs.mkdirSync(path.dirname(resultPath), {recursive:true});
  fs.writeFileSync(resultPath, JSON.stringify({ok:false, error:'Test did not complete'}));
  const child = spawn(require('electron'), [path.join(__dirname, 'startup-smoke.cjs'), ...args], {cwd:path.join(__dirname, '..'), env, windowsHide:false, stdio:'inherit'});
  child.once('error', reject);
  child.once('exit', code => {
    if (code !== 0) return reject(Error('Startup check exited with ' + code));
    const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    result.ok ? resolve() : reject(Error(result.error));
  });
});
(async () => { await run([]); await run(['--cancel']); })().catch(error => { console.error(error); process.exitCode = 1; });
