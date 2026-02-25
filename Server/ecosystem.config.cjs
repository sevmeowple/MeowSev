module.exports = {
  apps: [{
    name: 'meow-server',
    script: 'src/index.ts',
    interpreter: 'bun',
    watch: false,
    kill_timeout: 5000,
    wait_ready: false,
    listen_timeout: 3000,
  }]
}
