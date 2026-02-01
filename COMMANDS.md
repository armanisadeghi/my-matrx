# Commands

## Kill Ports - Two commands:
- ss -tlnp | grep PORT (or just ss -tlnp and find it, then look for pid on the right under process)
- kill PID — kill ad then type the pid number

### Example:
- ss -tlnp | grep 3000
- kill -9 257407
