---
title: Extract API package from main
status: done
---

Move HTTP handlers, routing, and server setup from main.go into `api/` with an `API` struct holding config and static FS.
