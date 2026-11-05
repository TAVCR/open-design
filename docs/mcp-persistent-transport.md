# Persistent desktop MCP transports

Local Codex revision 3 of the 0.26.1 baseline fixes premature stdio disconnection. The previous 30-minute idle timer closed a healthy desktop client's channel; cached clients then failed immediately even while the design application remained open.

The default is now 0 (no idle exit). Standard stdin EOF/client disconnect still closes the transport. OD_MCP_STDIO_IDLE_EXIT_MS remains an explicit opt-in positive timeout with its previous validation and bounds. Retain this fork delta during upgrades.

Verification: observed two failing regression assertions before the fix; 38 digital and 34 print focused checks now pass, plus guard and workspace typecheck. A real isolated client with 1500 ms idle closed after 2200 ms, while an override 0 client stayed usable. A fake-clock regression advances 24 hours under the default without closure. New clients against both installed revision 3 distributions list 27/28 tools and write/read a diagnostic file; existing managed compositions remain readable. This does not claim 24 hours of wall-clock observation.

The installed daemon bundles were checked for DEFAULT_MCP_STDIO_IDLE_EXIT_MS=0. A closed host-session transport needs a fresh connection; restarting the design UI alone cannot revive that ended stream. Connect through the canonical managed discovery paths; do not pin transient ports or repeatedly retry generation mutations.
