const { EmptyUpgradeScript } = require('@companion-module/base')

module.exports = [
	// Preserve the index of the legacy config upgrade so existing users run the next script.
	EmptyUpgradeScript,
	function (_context, props) {
		const updatedActions = []
		const defaults = { use_specific_clip: false, page_value: '1', cell_value: '1' }

		for (const action of props.actions) {
			if (action.actionId !== 'startclip' && action.actionId !== 'stopclip') continue

			const options = { ...action.options }
			let changed = false

			for (const [id, value] of Object.entries(defaults)) {
				if (options[id] === undefined) {
					options[id] = value
					changed = true
				}
			}

			if (changed) updatedActions.push({ ...action, options })
		}

		return {
			updatedConfig: null,
			updatedActions,
			updatedFeedbacks: [],
		}
	},
	function (_context, props) {
		const updatedActions = []

		for (const action of props.actions) {
			if (action.actionId !== 'startclip' && action.actionId !== 'stopclip') continue

			const options = { ...action.options }
			if (options.column_value !== undefined && options.row_value !== undefined) continue

			// The old FocusCell call used Page as column and Cell as row.
			// Keep those coordinates (including variables), and retain Page for page selection.
			if (options.column_value === undefined) options.column_value = options.page_value ?? '1'
			if (options.row_value === undefined) options.row_value = options.cell_value ?? '1'
			updatedActions.push({ ...action, options })
		}

		return {
			updatedConfig: null,
			updatedActions,
			updatedFeedbacks: [],
		}
	},
	function (context, props) {
		const updatedActions = []
		const gridColumns = Number((props.config ?? context.currentConfig)?.grid_columns ?? 8)
		for (const action of props.actions) {
			if (action.actionId !== 'selectclip') continue
			const options = { ...action.options }
			if (options.column_value !== undefined && options.row_value !== undefined) continue

			const cellText = String(options.cell_value ?? '').trim()
			const cell = Number(cellText)
			const canConvert =
				/^\+?\d+$/.test(cellText) &&
				Number.isSafeInteger(cell) &&
				cell >= 0 &&
				cell <= 2147483647 &&
				Number.isInteger(gridColumns) &&
				gridColumns >= 1 &&
				gridColumns <= 256
			if (!canConvert) {
				// Variables cannot be evaluated during upgrade. Keep their existing OSC behavior.
				updatedActions.push({ ...action, actionId: 'selectclip_legacy' })
				continue
			}
			// The old Grid.CellIndex value is one-based; zero also selected the first cell.
			const cueIndex = Math.max(1, cell) - 1
			if (options.column_value === undefined) options.column_value = String((cueIndex % gridColumns) + 1)
			if (options.row_value === undefined) options.row_value = String(Math.floor(cueIndex / gridColumns) + 1)
			updatedActions.push({ ...action, options })
		}
		return { updatedConfig: null, updatedActions, updatedFeedbacks: [] }
	},
]
