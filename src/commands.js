const { Regex } = require('@companion-module/base')

function integerOption(id, label, defaultValue, options = {}) {
	return {
		type: 'textinput',
		id,
		label,
		default: String(defaultValue),
		regex: options.regex ?? Regex.SIGNED_NUMBER,
		useVariables: true,
		tooltip: options.tooltip,
		minValue: options.minValue,
		maxValue: options.maxValue,
		valueType: 'integer',
	}
}

function floatOption(id, label, defaultValue, options = {}) {
	return {
		type: 'textinput',
		id,
		label,
		default: String(defaultValue),
		regex: options.regex ?? Regex.SIGNED_FLOAT,
		useVariables: true,
		tooltip: options.tooltip,
		minValue: options.minValue,
		maxValue: options.maxValue,
		valueType: 'float',
	}
}

function textOption(id, label, defaultValue, options = {}) {
	return {
		type: 'textinput',
		id,
		label,
		default: String(defaultValue),
		useVariables: true,
		regex: options.regex,
		tooltip: options.tooltip,
		valueType: 'string',
	}
}

function dropdownOption(id, label, choices, defaultValue, options = {}) {
	return {
		type: 'dropdown',
		id,
		label,
		choices,
		default: defaultValue,
		tooltip: options.tooltip,
	}
}

function valueCommand(id, name, path, value, type = 'i') {
	return {
		id,
		name,
		options: [],
		buildMessages: () => [{ path, type, value }],
	}
}

function triggerCommand(id, name, path) {
	return {
		id,
		name,
		options: [],
		buildMessages: () => [{ path, value: 1 }],
	}
}

function clipCoordinateOptions() {
	return [
		integerOption('page_value', 'Page', 1, {
			minValue: 0,
			tooltip: 'Page index, starting at 0.',
		}),
		integerOption('column_value', 'Column', 1, {
			minValue: 1,
			tooltip: 'Column in the specified page, starting at 1 on the left.',
		}),
		integerOption('row_value', 'Row', 1, {
			minValue: 1,
			tooltip: 'Row in the specified page, starting at 1 at the top.',
		}),
	]
}

function clipCommand(id, verb, buildPlaybackMessages, focusSpecificClip = true) {
	const options = [
		{
			type: 'checkbox',
			id: 'use_specific_clip',
			label: `${verb} a specific clip`,
			default: false,
		},
		...clipCoordinateOptions().map((option) => ({
			...option,
			isVisibleExpression: '$(options:use_specific_clip) === true',
		})),
	]

	return {
		id,
		name: `${verb} clip`,
		options,
		// Hidden coordinates must not prevent controlling the currently focused clip.
		getActiveOptions: (values) => (values.use_specific_clip ? options : options.slice(0, 1)),
		buildMessages: (values, config) => {
			const playbackMessages = buildPlaybackMessages(values, config)
			if (!values.use_specific_clip || !focusSpecificClip) return playbackMessages

			return [
				{ path: '/b/Grid/PageIndex', value: values.page_value },
				{
					// FocusCell takes column and row, not page and cell index.
					path: '/beyond/general/FocusCell',
					args: [
						{ type: 'i', value: values.column_value },
						{ type: 'i', value: values.row_value },
					],
				},
				...playbackMessages,
			]
		},
	}
}

function specificClipArguments(values, config = {}) {
	const gridColumns = Number(config.grid_columns ?? 8)
	if (!Number.isInteger(gridColumns) || gridColumns < 1 || gridColumns > 256) {
		throw new Error('Grid columns must be an integer between 1 and 256 in the connection settings')
	}
	if (values.column_value > gridColumns) {
		throw new Error(`Column must be at most ${gridColumns}, matching Grid columns in the connection settings`)
	}

	// Native OSC cue commands use zero-based page and flat cue indexes.
	// https://forums.pangolin.com/threads/beyond-to-receive-osc.21866/
	const cueIndex = (values.row_value - 1) * gridColumns + values.column_value - 1
	if (!Number.isSafeInteger(cueIndex) || cueIndex > 2147483647) {
		throw new Error('Row is too large to address a cue with OSC')
	}
	return [
		{ type: 'i', value: values.page_value },
		{ type: 'i', value: cueIndex },
	]
}

function startClipMessages(values, config) {
	if (!values.use_specific_clip) return [{ path: '/beyond/general/StartCell', value: 1 }]

	const args = specificClipArguments(values, config)
	return ['CueDown', 'CueUp'].map((command) => ({ path: `/beyond/general/${command}`, args }))
}

function stopClipMessages(values, config) {
	if (!values.use_specific_clip) return [{ path: '/beyond/general/StopCell', args: [] }]

	// Address the cue directly: stopping must not depend on a preceding page/focus change.
	return [{ path: '/beyond/general/StopCueNow', args: specificClipArguments(values, config) }]
}

function parseCustomArguments(input) {
	const text = String(input ?? '').trim()
	if (!text) {
		return []
	}

	const normalized = text.replaceAll(/[\u201c\u201d\u201e\u201f]/g, '"').replaceAll(/[\u2018\u2019\u201a\u201b]/g, "'")
	const regex = /[+-]?(?:\d*\.\d+|\d+\.\d*|\d+)|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|(\S+)/g
	const args = []

	for (const match of normalized.matchAll(regex)) {
		const token = match[0]

		if (match[1] !== undefined) {
			args.push({ type: 's', value: match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\') })
		} else if (match[2] !== undefined) {
			args.push({ type: 's', value: match[2].replace(/\\'/g, "'").replace(/\\\\/g, '\\') })
		} else if (/^[+-]?\d+$/.test(token)) {
			args.push({ type: 'i', value: Number.parseInt(token, 10) })
		} else if (/^[+-]?(?:\d*\.\d+|\d+\.\d*)$/.test(token)) {
			args.push({ type: 'f', value: Number.parseFloat(token) })
		} else if (match[3] !== undefined) {
			args.push({ type: 's', value: match[3] })
		}
	}

	return args
}

const LIVE_CONTROL_SCALAR_PARAMETERS = [
	{ id: 'size', label: 'size (-400..400, all axes)' },
	{ id: 'sizex', label: 'sizex (-400..400)' },
	{ id: 'sizey', label: 'sizey (-400..400)' },
	{ id: 'sizez', label: 'sizez (-400..400)' },
	{ id: 'zoom', label: 'zoom (0..100)' },
	{ id: 'posx', label: 'posx (-32768..32768)' },
	{ id: 'posy', label: 'posy (-32768..32768)' },
	{ id: 'posz', label: 'posz (-32768..32768)' },
	{ id: 'anglex', label: 'anglex (-2880..2880)' },
	{ id: 'angley', label: 'angley (-2880..2880)' },
	{ id: 'anglez', label: 'anglez (-2880..2880)' },
	{ id: 'rotox', label: 'rotox (-1440..1440)' },
	{ id: 'rotoy', label: 'rotoy (-1440..1440)' },
	{ id: 'rotoz', label: 'rotoz (-1440..1440)' },
	{ id: 'brightness', label: 'brightness (0..100)' },
	{ id: 'visiblepoints', label: 'visiblepoints (0..100)' },
	{ id: 'colorslider', label: 'colorslider (0..255)' },
	{ id: 'anispeed', label: 'anispeed (0..400)' },
	{ id: 'scanrate', label: 'scanrate (10..200)' },
	{ id: 'red', label: 'red (0..255)' },
	{ id: 'green', label: 'green (0..255)' },
	{ id: 'blue', label: 'blue (0..255)' },
	{ id: 'alpha', label: 'alpha (0..255)' },
	{ id: 'fx1', label: 'fx1 (-1..47)' },
	{ id: 'fx2', label: 'fx2 (-1..47)' },
	{ id: 'fx3', label: 'fx3 (-1..47)' },
	{ id: 'fx4', label: 'fx4 (-1..47)' },
	{ id: 'fx1action', label: 'fx1action (0..100)' },
	{ id: 'fx2action', label: 'fx2action (0..100)' },
	{ id: 'fx3action', label: 'fx3action (0..100)' },
	{ id: 'fx4action', label: 'fx4action (0..100)' },
]

const LIVE_CONTROL_PAIR_PARAMETERS = [
	{ id: 'size', label: 'size (x, y)' },
	{ id: 'pos', label: 'pos (x, y)' },
]

function createFloatArg(value) {
	return {
		type: 'f',
		value,
	}
}

const LIVE_CONTROL_COMMANDS = [
	{
		id: 'livecontrol_scalar',
		name: 'Live Control parameter',
		options: [
			dropdownOption(
				'parameter',
				'Parameter',
				LIVE_CONTROL_SCALAR_PARAMETERS.map((parameter) => ({
					id: parameter.id,
					label: parameter.label,
				})),
				'brightness',
				{
					tooltip: 'Sets one of the Pangolin Beyond master live control parameters that takes a single float value.',
				},
			),
			floatOption('value', 'Value', 0, {
				tooltip: 'Accepts variables and sends the value as an OSC float.',
			}),
		],
		buildMessages: (options) => [
			{
				path: `/beyond/master/livecontrol/${options.parameter}`,
				type: 'f',
				value: options.value,
			},
		],
	},
	{
		id: 'livecontrol_pair',
		name: 'Live Control parameter (2 values)',
		options: [
			dropdownOption(
				'parameter',
				'Parameter',
				LIVE_CONTROL_PAIR_PARAMETERS.map((parameter) => ({
					id: parameter.id,
					label: parameter.label,
				})),
				'size',
				{
					tooltip: 'Sets one of the Pangolin Beyond master live control parameters that takes two float values.',
				},
			),
			floatOption('value_1', 'Value 1', 0),
			floatOption('value_2', 'Value 2', 0),
		],
		buildMessages: (options) => [
			{
				path: `/beyond/master/livecontrol/${options.parameter}`,
				args: [createFloatArg(options.value_1), createFloatArg(options.value_2)],
			},
		],
	},
	{
		id: 'custom_osc',
		name: 'Custom OSC command',
		options: [
			textOption('path', 'OSC address', '/beyond/master/livecontrol/brightness', {
				regex: Regex.SOMETHING,
				tooltip: 'Paste the OSC address to send to BEYOND.',
			}),
			textOption('arguments', 'Arguments', '', {
				tooltip:
					'Optional. Use space-separated values. Integers are sent as i, decimals as f, and text as s. Quote strings with spaces.',
			}),
		],
		buildMessages: (options) => {
			const path = String(options.path).trim()
			if (!path) {
				throw new Error('OSC address is required')
			}

			return [
				{
					path,
					args: parseCustomArguments(options.arguments),
				},
			]
		},
	},
]

module.exports = [
	{
		id: 'Brightness',
		name: 'Brightness',
		options: [integerOption('brightness_value', 'Brightness', 100)],
		buildMessages: (options) => [
			{
				path: '/beyond/master/brightness',
				value: options.brightness_value,
			},
		],
	},
	{
		id: 'selectclip',
		name: 'Select clip',
		options: clipCoordinateOptions(),
		buildMessages: (options, config) => {
			const [page, cue] = specificClipArguments(options, config)
			// Grid.CellIndex uses 1 for the first cell; native cue commands use 0.
			const cellIndex = cue.value + 1
			if (cellIndex > 2147483647) throw new Error('Row is too large to select a cell with OSC')
			return [
				{ path: '/b/Grid/PageIndex', value: page.value },
				{ path: '/b/Grid/CellIndex', value: cellIndex },
			]
		},
	},
	{
		// Preserve dynamic flat Cell variables from older saved actions.
		id: 'selectclip_legacy',
		name: 'Select clip (legacy Cell index)',
		options: [integerOption('page_value', 'Page', 1), integerOption('cell_value', 'Cell', 1)],
		buildMessages: (options) => [
			{
				path: '/b/Grid/PageIndex',
				value: options.page_value,
			},
			{
				path: '/b/Grid/CellIndex',
				value: options.cell_value,
			},
		],
	},
	clipCommand('startclip', 'Start', startClipMessages),
	clipCommand('stopclip', 'Stop', stopClipMessages, false),
	{
		id: 'bpm',
		name: 'BPM',
		options: [integerOption('bpm_value', 'BPM', 60)],
		buildMessages: (options) => [
			{
				path: '/b/master/bpm',
				value: options.bpm_value,
			},
		],
	},
	{
		id: 'selectfxslot',
		name: 'Select FX slot',
		options: [
			integerOption('fx_layer', 'Effect layer', 1, {
				regex: Regex.NUMBER,
				minValue: 1,
				maxValue: 4,
				tooltip: 'Choose the FX layer number from 1 to 4.',
			}),
			integerOption('fx_slot', 'Effect slot', 0, {
				minValue: -1,
				maxValue: 47,
				tooltip: 'Use -1 to stop the current effect, or 0 to 47 to select a slot in the active FX row.',
			}),
		],
		buildMessages: (options) => [
			{
				path: `/beyond/master/livecontrol/fx${options.fx_layer}`,
				type: 'f',
				value: options.fx_slot,
			},
		],
	},
	triggerCommand('bpmtap', 'BPM Tap', '/beyond/general/BeatTap'),
	triggerCommand('laserenable', 'Enable Output', '/beyond/general/enablelaseroutput'),
	triggerCommand('laserdisable', 'Disable Output', '/beyond/general/disablelaseroutput'),
	valueCommand('dmxinenable', 'Enable DMX input', '/beyond/general/EnableDmxIn', 1, 'f'),
	valueCommand('dmxindisable', 'Disable DMX input', '/beyond/general/EnableDmxIn', 0, 'f'),
	triggerCommand('Blackout', 'Blackout', '/beyond/general/blackout'),
	triggerCommand('onecue', 'One cue', '/beyond/general/onecue'),
	triggerCommand('multicue', 'Multi cue', '/beyond/general/multicue'),
	triggerCommand('select', 'Click select', '/beyond/general/clickselect'),
	triggerCommand('toggle', 'Toggle', '/beyond/general/clicktoggle'),
	triggerCommand('restart', 'Restart', '/beyond/general/clickrestart'),
	triggerCommand('flash', 'Flash', '/beyond/general/clickflash'),
	triggerCommand('soloflash', 'Solo flash', '/beyond/general/clicksoloflash'),
	...LIVE_CONTROL_COMMANDS,
]
