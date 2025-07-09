#!/usr/bin/env node
import { FastMCP } from 'fastmcp';

declare const server: FastMCP<Record<string, unknown> | undefined>;

export { server };
