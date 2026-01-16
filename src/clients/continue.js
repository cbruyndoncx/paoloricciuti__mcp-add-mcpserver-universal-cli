/** @import { MCPServerConfig, AddOptions, AddResult } from './types.js' */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import YAML from 'yaml';

/**
 * Gets the Continue config file path based on scope
 * @param {boolean} is_global - Whether to use global config
 * @returns {string} The config file path
 */
function get_config_path(is_global) {
	if (is_global) {
		return path.join(os.homedir(), '.continue', 'config.yaml');
	} else {
		return path.join(process.cwd(), '.continue', 'config.yaml');
	}
}

/**
 * Reads the existing Continue config or returns empty config
 * @param {string} config_path - Path to the config file
 * @returns {Record<string, unknown>} The parsed config
 */
function read_config(config_path) {
	try {
		if (fs.existsSync(config_path)) {
			const content = fs.readFileSync(config_path, 'utf-8');
			const parsed = YAML.parse(content);
			return parsed || {};
		}
	} catch {
		// If file doesn't exist or is invalid, start fresh
	}
	return {};
}

/**
 * Transforms the generic MCP config to Continue YAML format
 * @param {MCPServerConfig} config - The generic server config
 * @returns {Record<string, unknown>} Continue formatted config entry
 */
function transform_config(config) {
	if (config.type === 'stdio') {
		/** @type {Record<string, unknown>} */
		const result = {
			name: config.name,
			type: 'stdio',
			command: config.command,
			args: config.args || [],
		};
		if (config.env && Object.keys(config.env).length > 0) {
			result.env = config.env;
		}
		return result;
	} else {
		/** @type {Record<string, unknown>} */
		const result = {
			name: config.name,
			type: config.type,
			url: config.url,
		};
		if (config.headers && Object.keys(config.headers).length > 0) {
			result.headers = config.headers;
		}
		return result;
	}
}

/**
 * Adds an MCP server configuration to Continue (VS Code extension)
 * @param {MCPServerConfig} config - The server configuration
 * @param {AddOptions} options - Additional options
 * @returns {Promise<AddResult>} Result of the operation
 */
export async function add_to_continue(config, options) {
	const config_path = get_config_path(options.is_global);

	try {
		// Ensure directory exists
		const dir = path.dirname(config_path);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		// Read existing config
		const existing_config = read_config(config_path);

		// Ensure mcpServers array exists
		if (!existing_config.mcpServers) {
			existing_config.mcpServers = [];
		}

		// Get the mcpServers array
		const mcp_servers = /** @type {Array<Record<string, unknown>>} */ (
			existing_config.mcpServers
		);

		// Check if server with this name already exists
		const existing_index = mcp_servers.findIndex((server) => server.name === config.name);

		const new_server = transform_config(config);

		if (existing_index >= 0) {
			// Replace existing server
			mcp_servers[existing_index] = new_server;
		} else {
			// Add new server
			mcp_servers.push(new_server);
		}

		// Write the config as YAML
		fs.writeFileSync(config_path, YAML.stringify(existing_config));

		return {
			success: true,
			path: config_path,
		};
	} catch (err) {
		return {
			success: false,
			path: config_path,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}
