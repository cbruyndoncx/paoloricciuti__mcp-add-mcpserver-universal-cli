/** @import { MCPServerConfig, AddOptions, AddResult } from './types.js' */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import YAML from 'yaml';

/**
 * Gets the Goose config file path
 * Goose uses ~/.config/goose/config.yaml
 * @returns {string} The config file path
 */
function get_config_path() {
	return path.join(os.homedir(), '.config', 'goose', 'config.yaml');
}

/**
 * Reads the existing Goose config or returns empty config
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
 * Transforms the generic MCP config to Goose extensions format
 * @param {MCPServerConfig} config - The generic server config
 * @returns {Record<string, unknown>} Goose formatted config entry
 */
function transform_config(config) {
	if (config.type === 'stdio') {
		/** @type {Record<string, unknown>} */
		const result = {
			name: config.name,
			cmd: config.command,
			args: config.args || [],
			enabled: true,
			type: 'stdio',
			timeout: 300,
		};
		if (config.env && Object.keys(config.env).length > 0) {
			result.envs = config.env;
		}
		return result;
	} else {
		/** @type {Record<string, unknown>} */
		const result = {
			name: config.name,
			type: 'streamable_http',
			url: config.url,
			enabled: true,
			timeout: 300,
		};
		if (config.headers && Object.keys(config.headers).length > 0) {
			result.headers = config.headers;
		}
		return result;
	}
}

/**
 * Adds an MCP server configuration to Goose
 * @param {MCPServerConfig} config - The server configuration
 * @param {AddOptions} _options - Additional options
 * @returns {Promise<AddResult>} Result of the operation
 */
export async function add_to_goose(config, _options) {
	const config_path = get_config_path();

	try {
		// Ensure directory exists
		const dir = path.dirname(config_path);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		// Read existing config
		const existing_config = read_config(config_path);

		// Ensure extensions object exists
		if (!existing_config.extensions) {
			existing_config.extensions = {};
		}

		// Add the new extension (MCP server)
		const extensions = /** @type {Record<string, unknown>} */ (existing_config.extensions);
		extensions[config.name] = transform_config(config);

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
