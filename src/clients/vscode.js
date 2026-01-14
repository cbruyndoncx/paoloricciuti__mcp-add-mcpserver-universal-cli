/** @import { MCPServerConfig, AddOptions, AddResult } from './types.js' */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Gets the VS Code user data directory based on platform
 * @returns {string} The VS Code user data directory
 */
function get_vscode_user_data_dir() {
	const platform = process.platform;
	const home = process.env.HOME || process.env.USERPROFILE || '';

	if (platform === 'darwin') {
		return path.join(home, 'Library', 'Application Support', 'Code', 'User');
	} else if (platform === 'win32') {
		return path.join(process.env.APPDATA || '', 'Code', 'User');
	} else {
		// Linux and others
		return path.join(home, '.config', 'Code', 'User');
	}
}

/**
 * Gets the VS Code MCP config file path based on scope
 * @param {boolean} is_global - Whether to use global config
 * @returns {string} The config file path
 */
function get_config_path(is_global) {
	if (is_global) {
		// VS Code user config - global MCP settings
		return path.join(get_vscode_user_data_dir(), 'mcp.json');
	} else {
		// Workspace-specific config
		return path.join(process.cwd(), '.vscode', 'mcp.json');
	}
}

/**
 * Reads the existing VS Code MCP config or returns empty config
 * @param {string} config_path - Path to the config file
 * @returns {Record<string, unknown>} The parsed config
 */
function read_config(config_path) {
	try {
		if (fs.existsSync(config_path)) {
			const content = fs.readFileSync(config_path, 'utf-8');
			return JSON.parse(content);
		}
	} catch {
		// If file doesn't exist or is invalid, start fresh
	}
	return {};
}

/**
 * Transforms the generic MCP config to VS Code format
 * @param {MCPServerConfig} config - The generic server config
 * @returns {Record<string, unknown>} VS Code formatted config
 */
function transform_config(config) {
	if (config.type === 'stdio') {
		/** @type {Record<string, unknown>} */
		const result = {
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
			type: 'http',
			url: config.url,
		};
		if (config.headers && Object.keys(config.headers).length > 0) {
			result.headers = config.headers;
		}
		return result;
	}
}

/**
 * Adds an MCP server configuration to VS Code
 * @param {MCPServerConfig} config - The server configuration
 * @param {AddOptions} options - Additional options
 * @returns {Promise<AddResult>} Result of the operation
 */
export async function add_to_vscode(config, options) {
	const config_path = get_config_path(options.is_global);

	try {
		// Ensure directory exists
		const dir = path.dirname(config_path);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		// Read existing config
		const existing_config = read_config(config_path);

		// Ensure servers object exists
		if (!existing_config.servers) {
			existing_config.servers = {};
		}

		// Add the new server
		const servers = /** @type {Record<string, unknown>} */ (existing_config.servers);
		servers[config.name] = transform_config(config);

		// Write the config
		fs.writeFileSync(config_path, JSON.stringify(existing_config, null, 2) + '\n');

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
