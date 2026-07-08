# How I would start a homelab in 2026


1. Tailscale (How to connect)
- Free, can be set up in 30min or less
- creates a personal VPN between your devices allowing you to reach them all with reserved static IPs
- Apple tv or other always on device as an exit node, browse remotely from that location
- Mullvad add on for extra exit nodes around the world, ~$5 per month
- Point your tailnet DNS at a pihole, instant network level ad blocking across all devices 


2. Proxmox or VPS (What to host on)


3. Docker (How to host)


4. Caddy (How to route it)
- Buy a domain and point at the reserved tailscale ip
- Docker proxy network
- custom subdomains
- open it to the public internet with tailnet funnel (dangerous)
- secure it behind an authentication service like authelia (don't lock yourself out)

5. Homepage (How to keep track of what you've built)