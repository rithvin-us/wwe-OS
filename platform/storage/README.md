# Platform · Storage

File and object storage abstraction: upload, download, signed URLs,
versioning hooks, virus-scan hooks, per-tenant buckets/prefixes.

- Owns: the storage interface and its backends (local, S3-compatible).
- Modules store files only through this layer — never directly.
