const { spawn } = require('child_process');
const path = require('path');

console.log('='.repeat(65));
console.log('  Starting CS543 CampusEats API Security System');
console.log('='.repeat(65));

// Start Backend on 3000
const backendProcess = spawn('node', ['server.js'], {
  cwd: path.join(__dirname, 'backend'),
  stdio: 'inherit',
  shell: true
});

// Start Frontend on 5173
const frontendProcess = spawn('node', ['server.js'], {
  cwd: path.join(__dirname, 'frontend'),
  stdio: 'inherit',
  shell: true
});

console.log('\n🚀 Servers initialized:');
console.log('   • Backend API: http://localhost:3000');
console.log('   • Frontend UI: http://localhost:5173\n');

process.on('SIGINT', () => {
  console.log('\nShutting down servers...');
  backendProcess.kill();
  frontendProcess.kill();
  process.exit();
});

