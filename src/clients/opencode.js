/** @import { MCPServerConfig, AddOptions, AddResult } from './types.js' */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as jsonc from 'jsonc-parser';

/**
 * Gets the OpenCode config file path based on scope
 * Checks for both .json and .jsonc extensions, preferring .jsonc if it exists
 * @param {boolean} is_global - Whether to use global config
 * @returns {string} The config file path
 */
function get_config_path(is_global) {
	/** @type {string} */
	let base_dir;
	if (is_global) {
		// Check XDG_CONFIG_HOME first, fallback to ~/.config
		const config_home = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
		base_dir = path.join(config_home, 'opencode');
	} else {
		base_dir = process.cwd();
	}

	const jsonc_path = path.join(base_dir, 'opencode.jsonc');
	const json_path = path.join(base_dir, 'opencode.json');

	// Prefer .jsonc if it exists, otherwise use .json
	if (fs.existsSync(jsonc_path)) {
		return jsonc_path;
	}

	return json_path;
}

/**
 * Reads the existing OpenCode config or returns empty config
 * @param {string} config_path - Path to the config file
 * @returns {{ content: string, config: Record<string, unknown> }} The raw content and parsed config
 */
function read_config(config_path) {
	try {
		if (fs.existsSync(config_path)) {
			const content = fs.readFileSync(config_path, 'utf-8');
			const config = jsonc.parse(content) || {};
			return { content, config };
		}
	} catch {
		// If file doesn't exist or is invalid, start fresh
	}
	return { content: '{}', config: {} };
}

/**
 * Transforms the generic MCP config to OpenCode format
 * @param {MCPServerConfig} config - The generic server config
 * @returns {Record<string, unknown>} OpenCode formatted config
 */
function transform_config(config) {
	if (config.type === 'stdio') {
		// OpenCode uses command as an array including the command and args
		const command_array = [config.command, ...(config.args || [])];
		/** @type {Record<string, unknown>} */
		const result = {
			type: 'local',
			command: command_array,
			enabled: true,
		};
		if (config.env && Object.keys(config.env).length > 0) {
			result.environment = config.env;
		}
		return result;
	} else {
		/** @type {Record<string, unknown>} */
		const result = {
			type: 'remote',
			url: config.url,
			enabled: true,
		};
		if (config.headers && Object.keys(config.headers).length > 0) {
			result.headers = config.headers;
		}
		return result;
	}
}

/**
 * Adds an MCP server configuration to OpenCode
 * @param {MCPServerConfig} config - The server configuration
 * @param {AddOptions} options - Additional options
 * @returns {Promise<AddResult>} Result of the operation
 */
export async function add_to_opencode(config, options) {
	const config_path = get_config_path(options.is_global);

	try {
		// Ensure directory exists
		const dir = path.dirname(config_path);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		// Read existing config
		const { content, config: existing_config } = read_config(config_path);

		// Prepare the new server config
		const new_server = transform_config(config);

		// Use jsonc.applyEdits to preserve comments and formatting
		let new_content = content;

		// Add $schema if not present
		if (!existing_config.$schema) {
			const schema_edit = jsonc.modify(
				new_content,
				['$schema'],
				'https://opencode.ai/config.json',
				{ formattingOptions: { tabSize: 2, insertSpaces: true } },
			);
			new_content = jsonc.applyEdits(new_content, schema_edit);
		}

		// Ensure mcp object exists
		if (!existing_config.mcp) {
			const mcp_edit = jsonc.modify(
				new_content,
				['mcp'],
				{},
				{ formattingOptions: { tabSize: 2, insertSpaces: true } },
			);
			new_content = jsonc.applyEdits(new_content, mcp_edit);
		}

		// Add the new server
		const server_edit = jsonc.modify(new_content, ['mcp', config.name], new_server, {
			formattingOptions: { tabSize: 2, insertSpaces: true },
		});
		new_content = jsonc.applyEdits(new_content, server_edit);

		// Write the config
		fs.writeFileSync(config_path, new_content + (new_content.endsWith('\n') ? '' : '\n'));

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
