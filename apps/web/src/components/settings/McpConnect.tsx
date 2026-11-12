import React, { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ApiKeyRecord } from '@propbot/shared';
import { apiRequest, xhrJsonTarget } from '../../services/api-client.js';
import { useApiKeys, useCreateApiKeyMutation } from '../../services/settings.service.js';
import { useTheme } from '../../contexts/ThemeContext.js';
import { useToast } from '../ui/Toast.js';

/**
 * Connect PropBot's MCP server to an AI client, in the "McpConnect" sheet design (from Cue).
 *  The card: a carousel of AI clients that keeps turning (drag or flick it), what the MCP does, and "Connect now".
 *  The list: each client with Connect, or "● Connected" once that client has used its key.
 *  The link: PropBot's tile and the client's, a line and a node between. Create an access key (an API key named
 *  "MCP · {client}", shown once), then the one way that client connects: a one-click install for Cursor and VS Code, a
 *  command for Claude Code, a config for Windsurf. The status row then waits for the client's first real request (the
 *  key's lastUsedAt, polled), and the line turns green with the server's real tool names.
 * Everything is real: the endpoint is this API's /api/mcp/sse, the key comes from /api/settings/api-keys.
 */

type How = 'oneclick' | 'command' | 'config';
type Client = { id: string; name: string; logo: string; how: How; file?: string };

const LOGOS = {
  claude: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQ4IiBoZWlnaHQ9IjI0OCIgdmlld0JveD0iMCAwIDI0OCAyNDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTUyLjQyODUgMTYyLjg3M0w5OC43ODQ0IDEzNi44NzlMOTkuNTQ4NSAxMzQuNjAyTDk4Ljc4NDQgMTMzLjMzNEg5Ni40OTIxTDg4LjcyMzcgMTMyLjg2Mkw2Mi4yMzQ2IDEzMi4xNTNMMzkuMzExMyAxMzEuMjA3TDE3LjAyNDkgMTMwLjAyNkwxMS40MjE0IDEyOC44NDRMNi4yIDEyMS44NzNMNi43MDk0IDExOC40NDdMMTEuNDIxNCAxMTUuMjU3TDE4LjE3MSAxMTUuODQ3TDMzLjA3MTEgMTE2LjkxMUw1NS40ODUgMTE4LjQ0N0w3MS42NTg2IDExOS4zOTJMOTUuNzI4IDEyMS44NzNIOTkuNTQ4NUwxMDAuMDU4IDEyMC4zMzdMOTguNzg0NCAxMTkuMzkyTDk3Ljc2NTYgMTE4LjQ0N0w3NC41ODc3IDEwMi43MzJMNDkuNDk5NSA4Ni4xOTA1TDM2LjM4MjMgNzYuNjJMMjkuMzc3OSA3MS43NzU3TDI1LjgxMjEgNjcuMjg1OEwyNC4yODM5IDU3LjM2MDhMMzAuNjUxNSA1MC4yNzE2TDM5LjMxMTMgNTAuODYyM0w0MS40NzYzIDUxLjQ1MzFMNTAuMjYzNiA1OC4xODc5TDY4Ljk4NDIgNzIuNzIwOUw5My40MzU3IDkwLjY4MDRMOTcuMDAxNSA5My42MzQzTDk4LjQzNzQgOTIuNjY1Mkw5OC42NTcxIDkxLjk4MDFMOTcuMDAxNSA4OS4yNjI1TDgzLjc1NyA2NS4yNzcyTDY5LjYyMSA0MC44MTkyTDYzLjI1MzQgMzAuNjU3OUw2MS41OTc4IDI0LjYzMkM2MC45NTY1IDIyLjEwMzIgNjAuNTc5IDIwLjAxMTEgNjAuNTc5IDE3LjQyNDZMNjcuODM4MSA3LjQ5OTY1TDcxLjkxMzMgNi4xOTk5NUw4MS43MTkzIDcuNDk5NjVMODUuNzk0NiAxMS4wNDQzTDkxLjkwNzQgMjQuOTg2NUwxMDEuNzE0IDQ2Ljg0NTFMMTE2Ljk5NiA3Ni42MkwxMjEuNDUzIDg1LjQ4MTZMMTIzLjg3MyA5My42MzQzTDEyNC43NjQgOTYuMTE1NUgxMjYuMjkyVjk0LjY5NzZMMTI3LjU2NiA3Ny45MTk3TDEyOS44NTggNTcuMzYwOEwxMzIuMTUgMzAuODk0MkwxMzIuOTE1IDIzLjQ1MDVMMTM2LjYwOCAxNC40NzA4TDE0My45OTQgOS42MjY0M0wxNDkuNzI1IDEyLjM0NEwxNTQuNDM3IDE5LjA3ODhMMTUzLjggMjMuNDUwNUwxNTAuOTk4IDQxLjY0NjNMMTQ1LjUyMiA3MC4xMjE1TDE0MS45NTcgODkuMjYyNUgxNDMuOTk0TDE0Ni40MTQgODYuNzgxM0wxNTYuMDkzIDc0LjAyMDZMMTcyLjI2NiA1My42OThMMTc5LjM5OCA0NS42NjM1TDE4Ny44MDMgMzYuODAyTDE5My4xNTIgMzIuNTQ4NEgyMDMuMzRMMjEwLjcyNiA0My42NTQ5TDIwNy40MTUgNTUuMTE1OUwxOTYuOTcyIDY4LjM0OTJMMTg4LjMxMiA3OS41NzM5TDE3NS44OTYgOTYuMjA5NUwxNjguMTkxIDEwOS41ODVMMTY4Ljg4MiAxMTAuNjg5TDE3MC43MzggMTEwLjUzTDE5OC43NTUgMTA0LjUwNEwyMTMuOTEgMTAxLjc4N0wyMzEuOTk0IDk4LjcxNDlMMjQwLjE0NCAxMDIuNDk2TDI0MS4wMzYgMTA2LjM5NUwyMzcuODUyIDExNC4zMTFMMjE4LjQ5NSAxMTkuMDM3TDE5NS44MjYgMTIzLjY0NUwxNjIuMDcgMTMxLjU5MkwxNjEuNjk2IDEzMS44OTNMMTYyLjEzNyAxMzIuNTQ3TDE3Ny4zNiAxMzMuOTI1TDE4My44NTUgMTM0LjI3OUgxOTkuNzc0TDIyOS40NDcgMTM2LjUyNEwyMzcuMjE1IDE0MS42MDVMMjQxLjggMTQ3Ljg2N0wyNDEuMDM2IDE1Mi43MTFMMjI5LjA2NSAxNTguNzM3TDIxMy4wMTkgMTU0Ljk1NkwxNzUuNDUgMTQ1Ljk3N0wxNjIuNTg3IDE0Mi43ODdIMTYwLjgwNVYxNDMuODVMMTcxLjUwMiAxNTQuMzY2TDE5MS4yNDIgMTcyLjA4OUwyMTUuODIgMTk1LjAxMUwyMTcuMDk0IDIwMC42ODJMMjEzLjkxIDIwNS4xNzJMMjEwLjU5OSAyMDQuNjk5TDE4OC45NDkgMTg4LjM5NEwxODAuNTQ0IDE4MS4wNjlMMTYxLjY5NiAxNjUuMTE4SDE2MC40MjJWMTY2Ljc3MkwxNjQuNzUyIDE3My4xNTJMMTg3LjgwMyAyMDcuNzcxTDE4OC45NDkgMjE4LjQwNUwxODcuMjk0IDIyMS44MzJMMTgxLjMwOCAyMjMuOTU5TDE3NC44MTMgMjIyLjc3N0wxNjEuMTg3IDIwMy43NTRMMTQ3LjMwNSAxODIuNDg2TDEzNi4wOTggMTYzLjM0NUwxMzQuNzQ1IDE2NC4yTDEyOC4wNzUgMjM1LjQyTDEyNS4wMTkgMjM5LjA4MkwxMTcuODg3IDI0MS44TDExMS45MDIgMjM3LjMxTDEwOC43MTggMjI5Ljk4NEwxMTEuOTAyIDIxNS40NTJMMTE1LjcyMiAxOTYuNTQ3TDExOC43NzkgMTgxLjU0MUwxMjEuNTggMTYyLjg3M0wxMjMuMjkxIDE1Ni42MzZMMTIzLjE0IDE1Ni4yMTlMMTIxLjc3MyAxNTYuNDQ5TDEwNy42OTkgMTc1Ljc1Mkw4Ni4zMDQgMjA0LjY5OUw2OS4zNjYzIDIyMi43NzdMNjUuMjkxIDIyNC40MzFMNTguMjg2NyAyMjAuNzY4TDU4LjkyMzUgMjE0LjI3TDYyLjg3MTMgMjA4LjQ4TDg2LjMwNCAxNzguNzA1TDEwMC40NCAxNjAuMTU1TDEwOS41NTEgMTQ5LjUwN0wxMDkuNDYyIDE0Ny45NjdMMTA4Ljk1OSAxNDcuOTI0TDQ2LjY5NzcgMTg4LjUxMkwzNS42MTgyIDE4OS45M0wzMC43Nzg4IDE4NS40NEwzMS40MTU2IDE3OC4xMTVMMzMuNzA3OSAxNzUuNzUyTDUyLjQyODUgMTYyLjg3M1oiIGZpbGw9IiNEOTc3NTciLz48L3N2Zz4=",
  cursor: "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJFYmVuZV8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZlcnNpb249IjEuMSIgdmlld0JveD0iMCAwIDQ2Ni43MyA1MzIuMDkiPjwhLS0gR2VuZXJhdG9yOiBBZG9iZSBJbGx1c3RyYXRvciAyOS42LjEsIFNWRyBFeHBvcnQgUGx1Zy1JbiAuIFNWRyBWZXJzaW9uOiAyLjEuMSBCdWlsZCA5KSAgLS0+PGRlZnM+PHN0eWxlPgogICAgICAuc3QwIHsKICAgICAgICBmaWxsOiAjMjYyNTFlOwogICAgICB9CiAgICA8L3N0eWxlPjwvZGVmcz48cGF0aCBjbGFzcz0ic3QwIiBkPSJNNDU3LjQzLDEyNS45NEwyNDQuNDIsMi45NmMtNi44NC0zLjk1LTE1LjI4LTMuOTUtMjIuMTIsMEw5LjMsMTI1Ljk0Yy01Ljc1LDMuMzItOS4zLDkuNDYtOS4zLDE2LjExdjI0Ny45OWMwLDYuNjUsMy41NSwxMi43OSw5LjMsMTYuMTFsMjEzLjAxLDEyMi45OGM2Ljg0LDMuOTUsMTUuMjgsMy45NSwyMi4xMiwwbDIxMy4wMS0xMjIuOThjNS43NS0zLjMyLDkuMy05LjQ2LDkuMy0xNi4xMXYtMjQ3Ljk5YzAtNi42NS0zLjU1LTEyLjc5LTkuMy0xNi4xMWgtLjAxWk00NDQuMDUsMTUxLjk5bC0yMDUuNjMsMzU2LjE2Yy0xLjM5LDIuNC01LjA2LDEuNDItNS4wNi0xLjM2di0yMzMuMjFjMC00LjY2LTIuNDktOC45Ny02LjUzLTExLjMxTDI0Ljg3LDE0NS42N2MtMi40LTEuMzktMS40Mi01LjA2LDEuMzYtNS4wNmg0MTEuMjZjNS44NCwwLDkuNDksNi4zMyw2LjU3LDExLjM5aC0uMDFaIi8+PC9zdmc+",
  vscode: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PG1hc2sgaWQ9Im1hc2swIiBtYXNrLXR5cGU9ImFscGhhIiBtYXNrVW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4PSIwIiB5PSIwIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik03MC45MTE5IDk5LjMxNzFDNzIuNDg2OSA5OS45MzA3IDc0LjI4MjggOTkuODkxNCA3NS44NzI1IDk5LjEyNjRMOTYuNDYwOCA4OS4yMTk3Qzk4LjYyNDIgODguMTc4NyAxMDAgODUuOTg5MiAxMDAgODMuNTg3MlYxNi40MTMzQzEwMCAxNC4wMTEzIDk4LjYyNDMgMTEuODIxOCA5Ni40NjA5IDEwLjc4MDhMNzUuODcyNSAwLjg3Mzc1NkM3My43ODYyIC0wLjEzMDEyOSA3MS4zNDQ2IDAuMTE1NzYgNjkuNTEzNSAxLjQ0Njk1QzY5LjI1MiAxLjYzNzExIDY5LjAwMjggMS44NDk0MyA2OC43NjkgMi4wODM0MUwyOS4zNTUxIDM4LjA0MTVMMTIuMTg3MiAyNS4wMDk2QzEwLjU4OSAyMy43OTY1IDguMzUzNjMgMjMuODk1OSA2Ljg2OTMzIDI1LjI0NjFMMS4zNjMwMyAzMC4yNTQ5Qy0wLjQ1MjU1MiAzMS45MDY0IC0wLjQ1NDYzMyAzNC43NjI3IDEuMzU4NTMgMzYuNDE3TDE2LjI0NzEgNTAuMDAwMUwxLjM1ODUzIDYzLjU4MzJDLTAuNDU0NjMzIDY1LjIzNzQgLTAuNDUyNTUyIDY4LjA5MzggMS4zNjMwMyA2OS43NDUzTDYuODY5MzMgNzQuNzU0MUM4LjM1MzYzIDc2LjEwNDMgMTAuNTg5IDc2LjIwMzcgMTIuMTg3MiA3NC45OTA1TDI5LjM1NTEgNjEuOTU4N0w2OC43NjkgOTcuOTE2N0M2OS4zOTI1IDk4LjU0MDYgNzAuMTI0NiA5OS4wMTA0IDcwLjkxMTkgOTkuMzE3MVpNNzUuMDE1MiAyNy4yOTg5TDQ1LjEwOTEgNTAuMDAwMUw3NS4wMTUyIDcyLjcwMTJWMjcuMjk4OVoiIGZpbGw9IndoaXRlIi8+PC9tYXNrPjxnIG1hc2s9InVybCgjbWFzazApIj48cGF0aCBkPSJNOTYuNDYxNCAxMC43OTYyTDc1Ljg1NjkgMC44NzU1NDJDNzMuNDcxOSAtMC4yNzI3NzMgNzAuNjIxNyAwLjIxMTYxMSA2OC43NSAyLjA4MzMzTDEuMjk4NTggNjMuNTgzMkMtMC41MTU2OTMgNjUuMjM3MyAtMC41MTM2MDcgNjguMDkzNyAxLjMwMzA4IDY5Ljc0NTJMNi44MTI3MiA3NC43NTRDOC4yOTc5MyA3Ni4xMDQyIDEwLjUzNDcgNzYuMjAzNiAxMi4xMzM4IDc0Ljk5MDVMOTMuMzYwOSAxMy4zNjk5Qzk2LjA4NiAxMS4zMDI2IDEwMCAxMy4yNDYyIDEwMCAxNi42NjY3VjE2LjQyNzVDMTAwIDE0LjAyNjUgOTguNjI0NiAxMS44Mzc4IDk2LjQ2MTQgMTAuNzk2MloiIGZpbGw9IiMwMDY1QTkiLz48ZyBmaWx0ZXI9InVybCgjZmlsdGVyMF9kKSI+PHBhdGggZD0iTTk2LjQ2MTQgODkuMjAzOEw3NS44NTY5IDk5LjEyNDVDNzMuNDcxOSAxMDAuMjczIDcwLjYyMTcgOTkuNzg4NCA2OC43NSA5Ny45MTY3TDEuMjk4NTggMzYuNDE2OUMtMC41MTU2OTMgMzQuNzYyNyAtMC41MTM2MDcgMzEuOTA2MyAxLjMwMzA4IDMwLjI1NDhMNi44MTI3MiAyNS4yNDZDOC4yOTc5MyAyMy44OTU4IDEwLjUzNDcgMjMuNzk2NCAxMi4xMzM4IDI1LjAwOTVMOTMuMzYwOSA4Ni42MzAxQzk2LjA4NiA4OC42OTc0IDEwMCA4Ni43NTM4IDEwMCA4My4zMzM0VjgzLjU3MjZDMTAwIDg1Ljk3MzUgOTguNjI0NiA4OC4xNjIyIDk2LjQ2MTQgODkuMjAzOFoiIGZpbGw9IiMwMDdBQ0MiLz48L2c+PGcgZmlsdGVyPSJ1cmwoI2ZpbHRlcjFfZCkiPjxwYXRoIGQ9Ik03NS44NTc4IDk5LjEyNjNDNzMuNDcyMSAxMDAuMjc0IDcwLjYyMTkgOTkuNzg4NSA2OC43NSA5Ny45MTY2QzcxLjA1NjQgMTAwLjIyMyA3NSA5OC41ODk1IDc1IDk1LjMyNzhWNC42NzIxM0M3NSAxLjQxMDM5IDcxLjA1NjQgLTAuMjIzMTA2IDY4Ljc1IDIuMDgzMjlDNzAuNjIxOSAwLjIxMTQwMiA3My40NzIxIC0wLjI3MzY2NiA3NS44NTc4IDAuODczNjMzTDk2LjQ1ODcgMTAuNzgwN0M5OC42MjM0IDExLjgyMTcgMTAwIDE0LjAxMTIgMTAwIDE2LjQxMzJWODMuNTg3MUMxMDAgODUuOTg5MSA5OC42MjM0IDg4LjE3ODYgOTYuNDU4NiA4OS4yMTk2TDc1Ljg1NzggOTkuMTI2M1oiIGZpbGw9IiMxRjlDRjAiLz48L2c+PGcgc3R5bGU9Im1peC1ibGVuZC1tb2RlOm92ZXJsYXkiIG9wYWNpdHk9IjAuMjUiPjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNNzAuODUxMSA5OS4zMTcxQzcyLjQyNjEgOTkuOTMwNiA3NC4yMjIxIDk5Ljg5MTMgNzUuODExNyA5OS4xMjY0TDk2LjQgODkuMjE5N0M5OC41NjM0IDg4LjE3ODcgOTkuOTM5MiA4NS45ODkyIDk5LjkzOTIgODMuNTg3MVYxNi40MTMzQzk5LjkzOTIgMTQuMDExMiA5OC41NjM1IDExLjgyMTcgOTYuNDAwMSAxMC43ODA3TDc1LjgxMTcgMC44NzM2OTVDNzMuNzI1NSAtMC4xMzAxOSA3MS4yODM4IDAuMTE1Njk5IDY5LjQ1MjcgMS40NDY4OEM2OS4xOTEyIDEuNjM3MDUgNjguOTQyIDEuODQ5MzcgNjguNzA4MiAyLjA4MzM1TDI5LjI5NDMgMzguMDQxNEwxMi4xMjY0IDI1LjAwOTZDMTAuNTI4MyAyMy43OTY0IDguMjkyODUgMjMuODk1OSA2LjgwODU1IDI1LjI0NkwxLjMwMjI1IDMwLjI1NDhDLTAuNTEzMzM0IDMxLjkwNjQgLTAuNTE1NDE1IDM0Ljc2MjcgMS4yOTc3NSAzNi40MTY5TDE2LjE4NjMgNTBMMS4yOTc3NSA2My41ODMyQy0wLjUxNTQxNSA2NS4yMzc0IC0wLjUxMzMzNCA2OC4wOTM3IDEuMzAyMjUgNjkuNzQ1Mkw2LjgwODU1IDc0Ljc1NEM4LjI5Mjg1IDc2LjEwNDIgMTAuNTI4MyA3Ni4yMDM2IDEyLjEyNjQgNzQuOTkwNUwyOS4yOTQzIDYxLjk1ODZMNjguNzA4MiA5Ny45MTY3QzY5LjMzMTcgOTguNTQwNSA3MC4wNjM4IDk5LjAxMDQgNzAuODUxMSA5OS4zMTcxWk03NC45NTQ0IDI3LjI5ODlMNDUuMDQ4MyA1MEw3NC45NTQ0IDcyLjcwMTJWMjcuMjk4OVoiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcikiLz48L2c+PC9nPjxkZWZzPjxmaWx0ZXIgaWQ9ImZpbHRlcjBfZCIgeD0iLTguMzk0MTEiIHk9IjE1LjgyOTEiIHdpZHRoPSIxMTYuNzI3IiBoZWlnaHQ9IjkyLjI0NTYiIGZpbHRlclVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgY29sb3ItaW50ZXJwb2xhdGlvbi1maWx0ZXJzPSJzUkdCIj48ZmVGbG9vZCBmbG9vZC1vcGFjaXR5PSIwIiByZXN1bHQ9IkJhY2tncm91bmRJbWFnZUZpeCIvPjxmZUNvbG9yTWF0cml4IGluPSJTb3VyY2VBbHBoYSIgdHlwZT0ibWF0cml4IiB2YWx1ZXM9IjAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDEyNyAwIi8+PGZlT2Zmc2V0Lz48ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSI0LjE2NjY3Ii8+PGZlQ29sb3JNYXRyaXggdHlwZT0ibWF0cml4IiB2YWx1ZXM9IjAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAuMjUgMCIvPjxmZUJsZW5kIG1vZGU9Im92ZXJsYXkiIGluMj0iQmFja2dyb3VuZEltYWdlRml4IiByZXN1bHQ9ImVmZmVjdDFfZHJvcFNoYWRvdyIvPjxmZUJsZW5kIG1vZGU9Im5vcm1hbCIgaW49IlNvdXJjZUdyYXBoaWMiIGluMj0iZWZmZWN0MV9kcm9wU2hhZG93IiByZXN1bHQ9InNoYXBlIi8+PC9maWx0ZXI+PGZpbHRlciBpZD0iZmlsdGVyMV9kIiB4PSI2MC40MTY3IiB5PSItOC4wNzU1OCIgd2lkdGg9IjQ3LjkxNjciIGhlaWdodD0iMTE2LjE1MSIgZmlsdGVyVW5pdHM9InVzZXJTcGFjZU9uVXNlIiBjb2xvci1pbnRlcnBvbGF0aW9uLWZpbHRlcnM9InNSR0IiPjxmZUZsb29kIGZsb29kLW9wYWNpdHk9IjAiIHJlc3VsdD0iQmFja2dyb3VuZEltYWdlRml4Ii8+PGZlQ29sb3JNYXRyaXggaW49IlNvdXJjZUFscGhhIiB0eXBlPSJtYXRyaXgiIHZhbHVlcz0iMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMTI3IDAiLz48ZmVPZmZzZXQvPjxmZUdhdXNzaWFuQmx1ciBzdGREZXZpYXRpb249IjQuMTY2NjciLz48ZmVDb2xvck1hdHJpeCB0eXBlPSJtYXRyaXgiIHZhbHVlcz0iMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMC4yNSAwIi8+PGZlQmxlbmQgbW9kZT0ib3ZlcmxheSIgaW4yPSJCYWNrZ3JvdW5kSW1hZ2VGaXgiIHJlc3VsdD0iZWZmZWN0MV9kcm9wU2hhZG93Ii8+PGZlQmxlbmQgbW9kZT0ibm9ybWFsIiBpbj0iU291cmNlR3JhcGhpYyIgaW4yPSJlZmZlY3QxX2Ryb3BTaGFkb3ciIHJlc3VsdD0ic2hhcGUiLz48L2ZpbHRlcj48bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MF9saW5lYXIiIHgxPSI0OS45MzkyIiB5MT0iMC4yNTc4MTIiIHgyPSI0OS45MzkyIiB5Mj0iOTkuNzQyMyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPjxzdG9wIHN0b3AtY29sb3I9IndoaXRlIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSJ3aGl0ZSIgc3RvcC1vcGFjaXR5PSIwIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PC9zdmc+",
  windsurf: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAyNCIgaGVpZ2h0PSIxMDI0IiB2aWV3Qm94PSIwIDAgMTAyNCAxMDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF8xMDlfNjMpIj48cmVjdCB3aWR0aD0iMTAyNCIgaGVpZ2h0PSIxMDI0IiBmaWxsPSIjRjlGM0U5Ii8+PHBhdGggZD0iTTg5Ny4yNDYgMjg2Ljg2OUg4ODkuODE5Qzg1MC43MzUgMjg2LjgwOCA4MTkuMDE3IDMxOC40NiA4MTkuMDE3IDM1Ny41MzlWNTE1LjU4OUM4MTkuMDE3IDU0Ny4xNSA3OTIuOTMgNTcyLjcxNiA3NjEuODgyIDU3Mi43MTZDNzQzLjQzNiA1NzIuNzE2IDcyNS4wMiA1NjMuNDMzIDcxNC4wOTMgNTQ3Ljg1TDU1Mi42NzMgMzE3LjMwNEM1MzkuMjggMjk4LjE2IDUxNy40ODYgMjg2Ljc0NyA0OTMuODk1IDI4Ni43NDdDNDU3LjA5NCAyODYuNzQ3IDQyMy45NzYgMzE4LjAzNCA0MjMuOTc2IDM1Ni42NTdWNTE1LjYxOUM0MjMuOTc2IDU0Ny4xODEgMzk4LjEwMyA1NzIuNzQ2IDM2Ni44NDIgNTcyLjc0NkMzNDguMzM1IDU3Mi43NDYgMzI5Ljk0OSA1NjMuNDYzIDMxOS4wMjEgNTQ3Ljg4MUwxMzguMzk1IDI4OS44ODJDMTM0LjMxNiAyODQuMDM4IDEyNS4xNTQgMjg2LjkzIDEyNS4xNTQgMjk0LjA1MlY0MzEuODkyQzEyNS4xNTQgNDM4Ljg2MiAxMjcuMjg1IDQ0NS42MTkgMTMxLjI3MiA0NTEuMzRMMzA5LjAzNyA3MDUuMkMzMTkuNTM5IDcyMC4yMDQgMzM1LjAzMyA3MzEuMzQ0IDM1Mi45IDczNS4zOTJDMzk3LjYxNiA3NDUuNTU3IDQzOC43NyA3MTEuMTM1IDQzOC43NyA2NjcuMjc4VjUwOC40MDZDNDM4Ljc3IDQ3Ni44NDUgNDY0LjMzOSA0NTEuMjc5IDQ5NS45MDQgNDUxLjI3OUg0OTUuOTk1QzUxNS4wMiA0NTEuMjc5IDUzMi44NTcgNDYwLjU2MiA1NDMuNzg1IDQ3Ni4xNDVMNzA1LjIzNSA3MDYuNjYxQzcxOC42NTkgNzI1LjgzNSA3MzkuMzI3IDczNy4yMTggNzYzLjk4MyA3MzcuMjE4QzgwMS42MDYgNzM3LjIxOCA4MzMuODQxIDcwNS45IDgzMy44NDEgNjY3LjMwOFY1MDguMzc2QzgzMy44NDEgNDc2LjgxNSA4NTkuNDEgNDUxLjI0OSA4OTAuOTc1IDQ1MS4yNDlIODk3LjI3NkM5MDEuMjMzIDQ1MS4yNDkgOTA0LjQzIDQ0OC4wNTMgOTA0LjQzIDQ0NC4wOTdWMjk0LjAyMUM5MDQuNDMgMjkwLjA2NSA5MDEuMjMzIDI4Ni44NjkgODk3LjI3NiAyODYuODY5SDg5Ny4yNDZaIiBmaWxsPSIjMEIxMDBGIi8+PC9nPjxkZWZzPjxjbGlwUGF0aCBpZD0iY2xpcDBfMTA5XzYzIj48cmVjdCB3aWR0aD0iMTAyNCIgaGVpZ2h0PSIxMDI0IiByeD0iMTAwIiBmaWxsPSJ3aGl0ZSIvPjwvY2xpcFBhdGg+PC9kZWZzPjwvc3ZnPg==",
};
const CLIENTS: Client[] = [
  { id: 'claude', name: 'Claude Code', logo: LOGOS.claude, how: 'command' },
  { id: 'cursor', name: 'Cursor', logo: LOGOS.cursor, how: 'oneclick' },
  { id: 'vscode', name: 'VS Code', logo: LOGOS.vscode, how: 'oneclick' },
  { id: 'windsurf', name: 'Windsurf', logo: LOGOS.windsurf, how: 'config', file: '~/.codeium/windsurf/mcp_config.json' },
];
// the carousel shows each client twice, so four clients still fill both sides of the front tile
const RING = [...CLIENTS, ...CLIENTS];
const SERVER = 'propbot';
const keyName = (c: Client) => `MCP · ${c.name}`;
const b64 = (s: string) => (typeof btoa === 'function' ? btoa(s) : '');

/** How each client reaches the server: the SSE endpoint, with the access key as a bearer header. */
function setup(c: Client, url: string, key: string) {
  const headers = { Authorization: `Bearer ${key}` };
  if (c.id === 'claude') return `claude mcp add --transport sse ${SERVER} ${url} --header "Authorization: Bearer ${key}"`;
  if (c.id === 'windsurf') return JSON.stringify({ mcpServers: { [SERVER]: { serverUrl: url, headers } } }, null, 2);
  return JSON.stringify({ mcpServers: { [SERVER]: { url, headers } } }, null, 2);
}
function deeplink(c: Client, url: string, key: string) {
  const headers = { Authorization: `Bearer ${key}` };
  if (c.id === 'cursor') return `cursor://anysphere.cursor-deeplink/mcp/install?name=${SERVER}&config=${encodeURIComponent(b64(JSON.stringify({ url, headers })))}`;
  if (c.id === 'vscode') return `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: SERVER, type: 'sse', url, headers }))}`;
  return '';
}

// a tile's place in the carousel, by its distance from the front one (d may be fractional while dragging)
function tileStyle(i: number, front: number, n: number, shift = 0): CSSProperties {
  let d = (((i - front - shift) % n) + n) % n;
  if (d > n / 2) d -= n;
  const a = Math.abs(d), x = Math.sign(d) * (a <= 1 ? a * 92 : 92 + (a - 1) * 86);
  const s = a <= 1 ? 1 - a * 0.16 : 0.84 - (a - 1) * 0.12, b = a <= 1 ? 1 - a * 0.08 : 0.92 - (a - 1) * 0.14;
  return {
    transform: `translate(calc(-50% + ${x.toFixed(2)}px), calc(-50% + ${(a * 6).toFixed(2)}px)) scale(${s.toFixed(3)})`,
    filter: a < 0.05 ? 'none' : `blur(${(a <= 1 ? a * 0.6 : 0.6 + (a - 1) * 2.2).toFixed(2)}px) brightness(${b.toFixed(3)})`,
    opacity: Math.max(0, Math.min(1, 3 - a)),
    zIndex: 5 - Math.round(a),
  };
}

const Tick = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
const MARK = (
  <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" />
  </svg>
);

type View = 'card' | 'list' | 'link';
type Phase = 'nokey' | 'idle' | 'wait' | 'ok' | 'error';
type Fly = { from: DOMRect; ra: number; fromEl: HTMLElement | null; client: Client; to: () => HTMLElement | null };

export const McpConnect: React.FC = () => {
  const { theme } = useTheme();
  const toaster = useToast();
  const qc = useQueryClient();
  const { data: keys = [] } = useApiKeys();
  const createKey = useCreateApiKeyMutation();
  const url = xhrJsonTarget('/api/mcp/sse').endpoint;
  const n = RING.length;

  const [view, setView] = useState<View>('card');
  const [front, setFront] = useState(0);
  const [cur, setCur] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('nokey');
  const [secret, setSecret] = useState<Record<string, { key: string; id: string }>>({});
  const [tools, setTools] = useState<string[]>([]);
  const [toolsIn, setToolsIn] = useState(false);
  const [enter, setEnter] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null), sheetRef = useRef<HTMLDivElement>(null), innerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null), tileRefs = useRef<(HTMLSpanElement | null)[]>([]), ptRef = useRef<HTMLSpanElement>(null);
  const flyRef = useRef<Fly | null>(null);
  const drag = useRef<{ x: number; shift: number; t: number; v: number; moved: boolean } | null>(null), lastDrag = useRef(0);
  const live = useRef({ view, front }); live.current = { view, front };

  const connectedKey = (c: Client): ApiKeyRecord | undefined => keys.find(k => k.name === keyName(c) && k.lastUsedAt);
  const isConnected = (c: Client) => Boolean(connectedKey(c));

  // the sheet's height follows what it shows
  useEffect(() => {
    const inner = innerRef.current, sheet = sheetRef.current;
    if (!inner || !sheet) return;
    const fit = () => { sheet.style.height = `${inner.offsetHeight}px`; };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  // the carousel keeps turning, except under a hand, just after a drag, and while linking
  useEffect(() => {
    const id = window.setInterval(() => {
      if (drag.current || live.current.view === 'link' || performance.now() - lastDrag.current < 1800) return;
      setFront(f => (f + 1) % n);
    }, 2200);
    return () => window.clearInterval(id);
  }, [n]);

  const placeAt = (f: number, shift: number) => tileRefs.current.forEach((t, i) => { if (t) Object.assign(t.style, tileStyle(i, f, n, shift)); });
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (view === 'link' || e.button > 0) return;
    drag.current = { x: e.clientX, shift: 0, t: performance.now(), v: 0, moved: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    stageRef.current?.classList.add('drag');
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const now = performance.now(), shift = (d.x - e.clientX) / 90;
    d.v = (shift - d.shift) / Math.max(1, now - d.t); d.shift = shift; d.t = now;
    if (Math.abs(shift) > 0.05) d.moved = true;
    placeAt(live.current.front, shift);
  };
  const onUp = () => {
    const d = drag.current;
    if (!d) return;
    const v = performance.now() - d.t > 90 ? 0 : d.v, go = Math.round(d.shift + Math.max(-1, Math.min(1, v * 180)));
    const f = (((live.current.front + go) % n) + n) % n;
    stageRef.current?.classList.remove('drag');
    drag.current = null;
    if (d.moved) lastDrag.current = performance.now();
    placeAt(f, 0);
    setFront(f);
  };

  // an icon flying from the row to the big tile and back; it follows its target every frame as the sheet resizes
  useEffect(() => {
    const job = flyRef.current, root = rootRef.current;
    flyRef.current = null;
    const to = job?.to();
    if (!job || !to || !root) return;
    const rb = parseFloat(getComputedStyle(to).borderRadius) || 16, a = job.from;
    const f = document.createElement('span');
    f.className = `mcx-fly ${to.classList.contains('mcx-ic') ? 'mcx-ic' : 'mcx-pt'}`;
    const img = document.createElement('img');
    img.src = job.client.logo; img.alt = '';
    f.appendChild(img);
    const put = (l: number, t: number, w: number, h: number, r: number) => { f.style.cssText = `left:${l}px;top:${t}px;width:${w}px;height:${h}px;border-radius:${r}px`; };
    put(a.left, a.top, a.width, a.height, job.ra);
    // on <body>: a transformed page wrapper would shift a fixed element placed inside it
    document.body.appendChild(f);
    to.style.visibility = 'hidden';
    if (job.fromEl) job.fromEl.style.visibility = 'hidden';
    const dur = to.classList.contains('mcx-ic') ? 520 : 620, t0 = performance.now();
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    let raf = 0;
    const end = () => { to.style.visibility = ''; if (job.fromEl) job.fromEl.style.visibility = ''; f.remove(); };
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur), e = ease(t), b = to.getBoundingClientRect(), lp = (x: number, y: number) => x + (y - x) * e;
      put(lp(a.left, b.left), lp(a.top, b.top) - Math.sin(Math.PI * t) * 18, lp(a.width, b.width), lp(a.height, b.height), lp(job.ra, rb));
      if (t < 1) raf = requestAnimationFrame(step); else end();
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); end(); };
  }, [view, enter]);

  const c = cur !== null ? CLIENTS[cur]! : null;
  const sec = c ? secret[c.id] : undefined;

  // waiting: the client is connected once its key makes a real request (the API stamps lastUsedAt)
  useEffect(() => {
    if (phase !== 'wait' || !c || !sec) return;
    const iv = window.setInterval(async () => {
      try {
        const list = await apiRequest<ApiKeyRecord[]>('/api/settings/api-keys');
        if (list.find(k => k.id === sec.id)?.lastUsedAt) {
          qc.setQueryData(['settings', 'api-keys'], list);
          setPhase('ok');
        }
      } catch { /* keep waiting */ }
    }, 3000);
    return () => window.clearInterval(iv);
  }, [phase, c?.id, sec?.id]);

  // once connected, list the tools this key really gets
  useEffect(() => {
    if (phase !== 'ok') return;
    setToolsIn(false);
    if (!sec) return;
    let alive = true;
    fetch(url.replace(/\/sse$/, '/tools'), { headers: { Authorization: `Bearer ${sec.key}` } })
      .then(r => r.json())
      .then((j: { data?: { tools?: { name: string }[] } }) => { if (alive) { setTools((j.data?.tools ?? []).map(t => t.name)); setTimeout(() => alive && setToolsIn(true), 30); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [phase, sec?.key]);

  const say = (text: string) => toaster.success(text);
  const copy = (text: string, msg: string) => { void navigator.clipboard?.writeText(text).catch(() => {}); say(msg); };

  const openClient = (i: number, row: HTMLElement) => {
    const client = CLIENTS[i]!, ic = row.querySelector<HTMLElement>('.mcx-ic');
    setCur(i); setFront(i); placeAt(i, 0); setErr(null);
    setPhase(isConnected(client) ? 'ok' : secret[client.id] ? 'idle' : 'nokey');
    if (ic) flyRef.current = { from: ic.getBoundingClientRect(), ra: parseFloat(getComputedStyle(ic).borderRadius) || 9, fromEl: ic, client, to: () => ptRef.current };
    setEnter(k => k + 1);
    setView('link');
  };
  const toList = () => {
    if (live.current.view === 'link' && cur !== null && ptRef.current) {
      const i = cur;
      flyRef.current = { from: ptRef.current.getBoundingClientRect(), ra: 16, fromEl: null, client: CLIENTS[i]!, to: () => rootRef.current?.querySelector<HTMLElement>(`[data-mcx-i="${i}"] .mcx-ic`) || null };
    }
    setView('list');
  };
  const close = () => setView('card');

  const makeKey = async () => {
    if (!c) return;
    setErr(null);
    try {
      // the API answers { id, apiKey } (the service's type says { apiKey, key }, so read both)
      const res = (await createKey.mutateAsync({ name: keyName(c), permissions: ['mcp:*'] })) as unknown as { apiKey: string; id?: string; key?: { id: string } };
      const id = res.id ?? res.key?.id;
      if (!res.apiKey || !id) throw new Error('The key was created but not returned. Check API keys below.');
      setSecret(s => ({ ...s, [c.id]: { key: res.apiKey, id } }));
      setPhase('idle');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create the key.');
      setPhase('error');
    }
  };
  const act = () => {
    if (!c || !sec) return;
    if (c.how === 'oneclick') window.location.href = deeplink(c, url, sec.key);
    else copy(setup(c, url, sec.key), 'Copied');
    setPhase('wait');
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (live.current.view === 'link') toList();
      else if (live.current.view === 'list') close();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const isOk = phase === 'ok', busy = phase === 'wait';
  const masked = (s: string) => (sec ? s.split(sec.key).join(`${sec.key.slice(0, 10)}…`) : s);
  const sub = !c ? '' : isOk ? `Try asking ${c.name}: “Who are my hottest leads in PropBot?”`
    : phase === 'nokey' || (phase === 'error' && !sec) ? `${c.name} needs its own access key. It is shown once, so it goes straight into the setup below.`
    : c.how === 'oneclick' ? `One click adds PropBot to ${c.name}.` : c.how === 'command' ? 'Run this once in your terminal.' : `Add this to ${c.file}.`;

  return (
    <div ref={rootRef} className={`mcx${theme === 'light' ? ' lt' : ''}`}>
      <style>{CSS}</style>
      <div ref={sheetRef} className={`mcx-sheet${view !== 'card' ? ' open' : ''}${view === 'link' ? ' linking' : ''}`} role="region" aria-label="Connect PropBot to your AI">
        <button type="button" className="mcx-topbtn mcx-x" aria-label="Close" tabIndex={view === 'card' ? -1 : 0} onClick={close}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <button type="button" className="mcx-topbtn mcx-back" aria-label="Back to the list" tabIndex={view === 'link' ? 0 : -1} onClick={toList}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div ref={innerRef} className="mcx-inner">
          <div className="mcx-grab" />
          <div ref={stageRef} className="mcx-stage" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-hidden="true">
            {RING.map((x, i) => (
              <span key={`${x.id}-${i}`} ref={el => { tileRefs.current[i] = el; }} className="mcx-tile" style={tileStyle(i, front, n)}>
                <img src={x.logo} alt="" draggable={false} />
              </span>
            ))}
            <span className="mcx-fade l" /><span className="mcx-fade r" />
          </div>
          <div className="mcx-views">
            <section className={`mcx-view${view === 'card' ? '' : ' off'}`} aria-hidden={view !== 'card'}>
              <h3 className="mcx-h">PropBot, inside your AI</h3>
              <p className="mcx-sub">Connect Claude, Cursor or VS Code to your CRM. Ask about leads, visits and inventory, or update them, without leaving the chat.</p>
              <button type="button" className="mcx-cta" tabIndex={view === 'card' ? 0 : -1} onClick={() => setView('list')}>Connect now</button>
            </section>
            <section className={`mcx-view${view === 'list' ? '' : ' off'}`} aria-hidden={view !== 'list'}>
              <h3 className="mcx-h">Bring PropBot to your AI</h3>
              <p className="mcx-sub">Each client gets its own access key, so you can switch one off without touching the others.</p>
              <div className="mcx-list">
                {CLIENTS.map((x, i) => (
                  <button key={x.id} type="button" className="mcx-row" data-mcx-i={i} tabIndex={view === 'list' ? 0 : -1} onClick={e => openClient(i, e.currentTarget)}>
                    <span className="mcx-ic"><img src={x.logo} alt="" /></span>
                    <span className="mcx-n">{x.name}</span>
                    {isConnected(x) ? <span className="mcx-pill ok"><i />Connected</span> : <span className="mcx-pill">Connect</span>}
                  </button>
                ))}
              </div>
            </section>
            <section className={`mcx-view${view === 'link' ? '' : ' off'}`} aria-hidden={view !== 'link'}>
              <div key={enter} className={`mcx-pair enter${busy ? ' busy' : ''}${isOk ? ' done' : ''}`}>
                <span className="mcx-pt me">{MARK}</span>
                <span className="mcx-beam">
                  <i /><s />
                  <span className="mcx-node">
                    <svg className="link" width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" /></svg>
                    <span className="tick"><Tick /></span>
                  </span>
                  <s />
                </span>
                <span ref={ptRef} className="mcx-pt them">{c && <img src={c.logo} alt={c.name} />}</span>
              </div>
              {c && (
                <>
                  <h3 className="mcx-h mcx-center" style={{ marginTop: 4 }}>{isOk ? `Connected to ${c.name}` : `Connect ${c.name}`}</h3>
                  <p className="mcx-sub mcx-center">{sub}</p>
                  {!isOk && (
                    <div className="mcx-how">
                      {!sec ? (
                        <button type="button" className="mcx-cta" tabIndex={view === 'link' ? 0 : -1} disabled={createKey.isPending} onClick={() => void makeKey()}>
                          {createKey.isPending ? 'Creating key…' : 'Create access key'}
                        </button>
                      ) : c.how === 'oneclick' ? (
                        <>
                          <button type="button" className="mcx-cta" tabIndex={view === 'link' ? 0 : -1} onClick={act}>Add to {c.name}</button>
                          <button type="button" className="mcx-alt" tabIndex={view === 'link' ? 0 : -1} onClick={() => { copy(setup(c, url, sec.key), 'Config copied'); setPhase('wait'); }}>or copy the config</button>
                        </>
                      ) : (
                        <pre className="mcx-code">
                          {c.how === 'command' && <span className="k">$ </span>}{masked(setup(c, url, sec.key))}
                          <button type="button" className="mcx-copy" tabIndex={view === 'link' ? 0 : -1} onClick={act}>Copy</button>
                        </pre>
                      )}
                    </div>
                  )}
                  <div className="mcx-status" aria-live="polite">
                    {phase === 'nokey' && <><span className="mcx-dot" />No key for {c.name} yet<span className="mcx-r">{url.replace(/^https?:\/\//, '')}</span></>}
                    {phase === 'idle' && <><span className="mcx-dot" />Not connected yet<span className="mcx-r">key {sec?.key.slice(0, 8)}…</span></>}
                    {phase === 'wait' && <><span className="mcx-spin" />Waiting for {c.name} to make its first request…</>}
                    {phase === 'error' && <><span className="mcx-dot err" />{err ?? `Couldn't reach ${c.name}. Try again.`}</>}
                    {isOk && <><span className="mcx-okic"><Tick size={10} /></span>Connected{tools.length ? ` · ${tools.length} tools` : ''}<span className="mcx-r">{connectedKey(c)?.lastUsedAt ? new Date(connectedKey(c)!.lastUsedAt!).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'just now'}</span></>}
                  </div>
                  {isOk && tools.length > 0 && (
                    <div className={`mcx-tools${toolsIn ? ' in' : ''}`}>
                      {tools.map((t, k) => <span key={t} style={{ transitionDelay: `${420 + k * 60}ms` }}>{t}</span>)}
                    </div>
                  )}
                  {isOk && <button type="button" className="mcx-cta" tabIndex={view === 'link' ? 0 : -1} onClick={toList}>Done</button>}
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

/* Cue's sheet, with its card, rim and button colours taken from the app's theme tokens */
const CSS = `
.mcx { position: relative; display: flex; justify-content: center; color: var(--text); -webkit-font-smoothing: antialiased; }
.mcx *, .mcx *::before, .mcx *::after { box-sizing: border-box; }
.mcx button { font: inherit; color: inherit; border: 0; padding: 0; margin: 0; background: none; cursor: pointer; }
.mcx :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.mcx-sheet { position: relative; width: min(380px, 100%); border-radius: 30px; overflow: hidden; background: var(--surface); box-shadow: inset 0 0 0 1px var(--border), 0 24px 50px -30px rgba(0,0,0,.45); transition: height .55s cubic-bezier(.22,1,.36,1); }
.mcx-inner { position: relative; padding: 10px 14px 16px; }
.mcx-grab { width: 36px; height: 4px; border-radius: 4px; background: var(--border); margin: 0 auto 10px; }
.mcx-topbtn { position: absolute; top: 20px; width: 30px; height: 30px; border-radius: 999px; background: var(--surface-2); display: grid; place-items: center; color: var(--text-muted); z-index: 9; opacity: 0; pointer-events: none; transition: opacity .3s, background .2s; }
.mcx-topbtn:hover { color: var(--text); }
.mcx-x { left: 16px; } .mcx-back { right: 16px; }
.mcx-sheet.open .mcx-x { opacity: 1; pointer-events: auto; }
.mcx-sheet.linking .mcx-back { opacity: 1; pointer-events: auto; }
.mcx-stage { position: relative; height: 150px; margin: 0 -14px; overflow: hidden; cursor: grab; touch-action: pan-y; user-select: none; -webkit-user-select: none; transition: height .55s cubic-bezier(.22,1,.36,1); }
.mcx-sheet.open .mcx-stage { height: 140px; }
.mcx-sheet.linking .mcx-stage { height: 0; }
.mcx-stage.drag { cursor: grabbing; }
.mcx-tile { position: absolute; top: 50%; left: 50%; display: grid; place-items: center; border-radius: 18px; width: 76px; height: 76px; background: linear-gradient(180deg, #ffffff, #eeeef1); box-shadow: inset 0 1px 0 #fff, inset 0 0 0 1px rgba(0,0,0,.07), 0 14px 26px -10px rgba(20,20,30,.32); transition: transform .7s cubic-bezier(.22,1,.36,1), filter .7s, opacity .7s; }
.mcx-stage.drag .mcx-tile { transition: none; }
.mcx-tile img, .mcx-ic img, .mcx-pt img { display: block; width: 58%; height: 58%; object-fit: contain; pointer-events: none; -webkit-user-drag: none; }
.mcx-fade { position: absolute; top: 0; bottom: 0; width: 34%; z-index: 7; pointer-events: none; background: linear-gradient(90deg, var(--surface) 0%, var(--surface) 13%, color-mix(in srgb, var(--surface) 85%, transparent) 26%, color-mix(in srgb, var(--surface) 40%, transparent) 46%, transparent 72%); }
.mcx-fade.l { left: 0; } .mcx-fade.r { right: 0; transform: scaleX(-1); }
.mcx-views { position: relative; display: grid; }
.mcx-view { grid-area: 1 / 1; transition: opacity .35s, transform .45s cubic-bezier(.22,1,.36,1); }
.mcx-view.off { position: absolute; inset: 0 0 auto; opacity: 0; transform: translateY(8px); pointer-events: none; visibility: hidden; }
.mcx-h { font-size: 17px; font-weight: 600; letter-spacing: -.01em; line-height: 1.3; margin: 14px 4px 6px; }
.mcx-sub { font-size: 13.5px; line-height: 1.45; color: var(--text-muted); margin: 0 4px; }
.mcx-center { text-align: center; }
.mcx-cta { display: grid; place-items: center; width: 100%; height: 44px; margin-top: 16px; border-radius: 999px; background: var(--accent) !important; color: var(--on-accent, #fff) !important; font-size: 15px; font-weight: 600; transition: transform .12s, filter .2s; }
.mcx-cta:hover { filter: brightness(1.08); } .mcx-cta:active { transform: scale(.98); } .mcx-cta:disabled { opacity: .6; cursor: default; }
.mcx-how .mcx-cta { margin-top: 0; }
.mcx-list { margin-top: 14px; border-radius: 18px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--border-subtle, var(--border)); padding: 4px 0; }
.mcx-row { display: flex; align-items: center; gap: 12px; width: 100%; height: 52px; padding: 0 12px; text-align: left; transition: background .2s; }
.mcx-row + .mcx-row { border-top: 1px solid var(--border-subtle, var(--border)); }
.mcx-row:hover { background: color-mix(in srgb, var(--surface) 50%, transparent); }
.mcx-ic { width: 30px; height: 30px; border-radius: 9px; background: #f4f4f5; box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); display: grid; place-items: center; flex: none; }
.mcx-ic img { width: 62%; height: 62%; }
.mcx-n { font-size: 14.5px; }
.mcx-pill { margin-left: auto; height: 28px; padding: 0 12px; border-radius: 999px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--border); font-size: 12.5px; font-weight: 500; display: grid; place-items: center; }
.mcx-pill.ok { background: none; box-shadow: none; color: var(--success); display: inline-flex; gap: 6px; align-items: center; padding: 0 2px; }
.mcx-pill.ok i { width: 6px; height: 6px; border-radius: 999px; background: var(--success); }
.mcx-pair { display: flex; align-items: center; justify-content: center; height: 120px; }
.mcx-pt { width: 56px; height: 56px; border-radius: 16px; display: grid; place-items: center; flex: none; background: linear-gradient(180deg, #ffffff, #eeeef1); box-shadow: inset 0 1px 0 #fff, inset 0 0 0 1px rgba(0,0,0,.07), 0 14px 26px -10px rgba(20,20,30,.32); transition: transform .6s cubic-bezier(.34,1.56,.64,1); }
.mcx-pt.me { background: var(--accent); color: var(--on-accent, #fff); box-shadow: 0 14px 26px -10px var(--accent-glow-strong, rgba(0,0,0,.3)); }
.mcx-beam { position: relative; display: flex; align-items: center; width: 84px; transition: width .6s cubic-bezier(.34,1.56,.64,1); }
.mcx-beam s { flex: 1; height: 2px; position: relative; opacity: .5; background: radial-gradient(circle, var(--text) .9px, transparent 1.3px) 0 50% / 6px 2px repeat-x; animation: mcx-dash 1.6s linear infinite; transition: opacity .4s; }
@keyframes mcx-dash { to { background-position: 6px 50% } }
.mcx-pair.busy .mcx-beam s { opacity: 1; animation-duration: .35s; }
.mcx-beam > i { position: absolute; top: 50%; left: 0; width: 6px; height: 6px; margin-top: -3px; border-radius: 999px; background: var(--accent); opacity: 0; z-index: 2; }
.mcx-pair.busy .mcx-beam > i { animation: mcx-shuttle 1.2s cubic-bezier(.6,0,.4,1) infinite alternate; }
@keyframes mcx-shuttle { 0% { left: -4px; opacity: 0 } 12% { opacity: 1 } 88% { opacity: 1 } 100% { left: calc(100% - 2px); opacity: 0 } }
.mcx-node { position: relative; width: 28px; height: 28px; border-radius: 999px; flex: none; display: grid; place-items: center; background: var(--surface); box-shadow: inset 0 0 0 1px var(--border); color: var(--text-muted); z-index: 1; transition: background .4s, color .4s, transform .5s cubic-bezier(.34,1.56,.64,1); }
.mcx-node::before { content: ''; position: absolute; inset: -4px; border-radius: inherit; opacity: 0; transition: opacity .3s; background: conic-gradient(from 0deg, transparent 0 62%, var(--accent) 100%); -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 1.6px), #000 calc(100% - 1.4px)); mask: radial-gradient(farthest-side, transparent calc(100% - 1.6px), #000 calc(100% - 1.4px)); }
.mcx-pair.busy .mcx-node { color: var(--text); }
.mcx-pair.busy .mcx-node::before { opacity: 1; animation: mcx-spin .8s linear infinite; }
@keyframes mcx-spin { to { transform: rotate(360deg) } }
.mcx-node::after { content: ''; position: absolute; inset: 0; border-radius: inherit; box-shadow: 0 0 0 1.5px #3fbf6f; opacity: 0; }
.mcx-pair.done .mcx-node::after { animation: mcx-ring .9s .15s cubic-bezier(.22,1,.36,1) both; }
@keyframes mcx-ring { 0% { transform: scale(1); opacity: .9 } 100% { transform: scale(2.4); opacity: 0 } }
.mcx-node .tick { display: none; }
.mcx-pair.done .mcx-beam { width: 64px; }
.mcx-pair.done .mcx-beam s { opacity: 1; background: #3fbf6f; height: 1.5px; animation: none; }
.mcx-pair.done .mcx-beam > i { display: none; }
.mcx-pair.done .mcx-pt.me { transform: translateX(4px); } .mcx-pair.done .mcx-pt.them { transform: translateX(-4px); }
.mcx-pair.done .mcx-node { background: #3fbf6f; box-shadow: none; color: #fff; transform: scale(1.1); }
.mcx-pair.done .mcx-node .link { display: none; } .mcx-pair.done .mcx-node .tick { display: block; animation: mcx-pop .4s cubic-bezier(.34,1.56,.64,1) both; }
@keyframes mcx-pop { from { transform: scale(0) } }
.mcx-pair.enter .mcx-pt.me { animation: mcx-inL .55s .22s cubic-bezier(.22,1,.36,1) both; }
.mcx-pair.enter .mcx-beam { animation: mcx-inBeam .5s .3s cubic-bezier(.22,1,.36,1) both; }
@keyframes mcx-inL { from { opacity: 0; transform: translateX(46px) scale(.85) } }
@keyframes mcx-inBeam { from { opacity: 0; clip-path: inset(0 0 0 100%) } to { clip-path: inset(0 0 0 0) } }
.mcx-fly { position: fixed; z-index: 50; pointer-events: none; margin: 0; }
.mcx-how { margin-top: 14px; }
.mcx-code { position: relative; border-radius: 14px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--border); padding: 12px 64px 12px 14px; font: 400 12px/1.55 var(--font-mono, monospace); color: var(--text); white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; }
.mcx-code .k { color: var(--text-faint); }
.mcx-copy { position: absolute; right: 8px; top: 8px; height: 26px; padding: 0 9px; border-radius: 8px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--border); color: var(--text-muted); font-size: 11.5px; transition: color .2s; }
.mcx-copy:hover { color: var(--text); }
.mcx-alt { display: block; margin: 10px auto 0; font-size: 12.5px; color: var(--text-muted); text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--border); }
.mcx-alt:hover { color: var(--text); }
.mcx-status { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 12px 14px; border-radius: 14px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--border-subtle, var(--border)); font-size: 13px; line-height: 1.35; color: var(--text-muted); min-height: 46px; }
.mcx-spin { width: 14px; height: 14px; border-radius: 999px; border: 1.6px solid var(--border); border-top-color: var(--accent); animation: mcx-spin .8s linear infinite; flex: none; }
.mcx-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--text-faint); flex: none; }
.mcx-dot.err { background: var(--danger); }
.mcx-okic { width: 18px; height: 18px; border-radius: 999px; background: #3fbf6f; color: #fff; display: grid; place-items: center; flex: none; }
.mcx-r { margin-left: auto; font: 400 11px var(--font-mono, monospace); color: var(--text-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 45%; }
.mcx-tools { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 12px 4px 0; font: 400 11.5px var(--font-mono, monospace); color: var(--text-muted); }
.mcx-tools span { opacity: 0; transform: translateY(4px); transition: opacity .3s, transform .4s cubic-bezier(.22,1,.36,1); }
.mcx-tools.in span { opacity: 1; transform: none; }
.mcx-tools span::before { content: '· '; color: var(--text-faint); }
@media (prefers-reduced-motion: reduce) { .mcx *, .mcx *::before, .mcx *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }
`;
