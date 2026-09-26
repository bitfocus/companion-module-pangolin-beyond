const { InstanceBase, Regex, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')
const UpdateVariableDefinitions = require('./variables')

class ModuleInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.config = {}
	}

	async init(config) {
		this.config = config

		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.resetVariables()
		this.refreshStatus()
	}

	async destroy() {
		this.log('debug', 'destroy')
	}

	async configUpdated(config) {
		this.config = config
		this.resetVariables()
		this.refreshStatus()
	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Configuration',
				value:
					'Send OSC commands to the Pangolin Beyond OSC server. Match the host and UDP port to the OSC settings configured in Beyond.',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Target Hostname or IP',
				width: 8,
				regex: Regex.HOSTNAME,
				required: true,
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Target Port',
				width: 4,
				regex: Regex.PORT,
				required: true,
			},
			{
				type: 'number',
				id: 'grid_columns',
				label: 'Grid columns',
				width: 4,
				default: 8,
				min: 1,
				max: 256,
				step: 1,
				tooltip:
					'Match the number of columns in the BEYOND cue grid. Used when selecting, starting or stopping a specific clip.',
			},
		]
	}

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
	}

	resetVariables() {
		this.setVariableValues({
			target_host: String(this.config.host ?? ''),
			target_port: String(this.config.port ?? ''),
			last_action: '',
			last_sent_summary: '',
			last_sent_at: '',
			last_message_count: 0,
		})
	}

	refreshStatus() {
		try {
			this.getTarget()
			this.updateStatus(InstanceStatus.Ok)
		} catch (_error) {
			// getTarget() already set the module status
		}
	}

	getTarget() {
		const host = String(this.config.host ?? '').trim()
		if (!host) {
			this.updateStatus(InstanceStatus.BadConfig, 'Target host is required')
			throw new Error('Target host is required')
		}

		const port = Number.parseInt(String(this.config.port ?? '').trim(), 10)
		if (!Number.isInteger(port) || port < 1 || port > 65535) {
			this.updateStatus(InstanceStatus.BadConfig, 'Target port must be between 1 and 65535')
			throw new Error('Target port must be between 1 and 65535')
		}

		return { host, port }
	}

	sendCommandBatch(actionId, messages) {
		const target = this.getTarget()

		for (const message of messages) {
			const args = Array.isArray(message.args)
				? message.args
				: {
						type: message.type ?? 'i',
						value: message.value,
					}

			this.oscSend(target.host, target.port, message.path, args)
		}

		this.setVariableValues({
			target_host: target.host,
			target_port: String(target.port),
			last_action: actionId,
			last_sent_summary: messages
				.map((message) => {
					if (Array.isArray(message.args)) {
						return `${message.path} ${message.args.map((arg) => arg.value).join(' ')}`
					}

					return `${message.path} ${message.value}`
				})
				.join(' | '),
			last_sent_at: new Date().toISOString(),
			last_message_count: messages.length,
		})

		this.updateStatus(InstanceStatus.Ok)
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
