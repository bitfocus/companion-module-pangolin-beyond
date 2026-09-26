## Pangolin BEYOND

Control BEYOND from Companion buttons: select and play cues, adjust brightness and tempo, choose effects, and control output. Actions use the word clip to refer to a cue in BEYOND's grid.

### Setup

1. Enable the OSC server in BEYOND and note its UDP port.
2. Add this connection in Companion. Set Target Hostname or IP to the computer running BEYOND and Target Port to its OSC UDP port.
3. Set Grid columns to the number of columns in your BEYOND cue grid (default: 8). Update this setting whenever you change the grid layout.
4. Add a Select clip action to a button and enter a cue's page, column, and row. Press the button and check that BEYOND selects the expected cue.

The module sends commands without receiving BEYOND's current state. An OK connection status does not confirm that BEYOND received a command, and there are no feedbacks for showing which cues are playing.

### Cue control

- Select clip: selects a page and cue without starting playback.
- Start clip: starts the focused cue. Enable "Start a specific clip" to choose a page, column, and row.
- Stop clip: stops the focused cue. Enable "Stop a specific clip" to stop a chosen cue immediately without changing the selected page or focused cue.

For all three actions, Page starts at 0, while Column and Row start at 1. For example, the top-left cue on the first page is Page 0, Column 1, Row 1. The column must not exceed Grid columns in the connection settings.

Starting a specific cue also selects its page and focuses it. This action acts like a brief click and is intended to follow BEYOND's current playback modes:

- Use One cue or Multi cue to choose the cue playback mode.
- Use Toggle or Restart for normal playback.
- With Click select, clicking only selects the cue.
- With Flash or Solo flash, the action sends a brief press and release. Holding the Companion button does not hold the cue on.

These mode actions change how BEYOND handles cue clicks; they do not start a cue themselves. Starting the focused cue with Start a specific clip disabled may not follow One cue/Multi cue behavior. Specific cue start/stop behavior still needs live verification on BEYOND 5.5; check it with your setup before relying on it.

### Other controls

- Brightness: set master brightness.
- BPM and BPM Tap: set or tap the tempo.
- Select FX slot: choose effect layer 1 to 4 and slot 0 to 47 in the active FX row. Use slot -1 to stop the current effect.
- Live Control parameter: adjust master size, position, rotation, color, or other live controls. Use the range shown in the parameter name.
- Live Control parameter (2 values): adjust size or position on both axes. Value 1 is X; Value 2 is Y.
- Enable Output and Disable Output: turn laser output on or off.
- Blackout: trigger BEYOND's blackout command.
- Enable DMX input and Disable DMX input: control BEYOND's DMX IN toolbar state.

### Custom OSC commands

Use Custom OSC command for commands not covered by the other actions. Enter the OSC address and any space-separated Arguments. Both fields accept Companion variables.

Whole numbers are sent as integers, decimal numbers as floats, and text as strings. Use quotes around text containing spaces, such as `"my cue"`. Leave Arguments empty for a command with no arguments.

For example, to set master Live Control brightness to 50, use address `/beyond/master/livecontrol/brightness` and arguments `50.0`.

### Variables

Use these variables in button text or to help troubleshoot commands. They describe the module's configuration and outgoing commands, not BEYOND's playback state.

- target_host: configured hostname or IP.
- target_port: configured UDP port.
- last_action: identifier of the last action sent.
- last_sent_summary: OSC addresses and values sent by the last action.
- last_sent_at: time of the last command, in ISO-8601 format (UTC).
- last_message_count: number of OSC messages sent by the last action.

### Troubleshooting

- BEYOND does not respond: Check that its OSC server is enabled, the host and UDP port match, and the network and firewall allow UDP traffic to that port. Check Companion's log for action errors.
- The wrong cue is selected or controlled: Check Grid columns, then the action's page, column, and row. Remember that Page starts at 0.
- A specific cue is selected but does not keep playing: Check BEYOND's click mode. Use Toggle or Restart; Click select only selects, and Flash/Solo flash receives a brief click.

### Updating

- Review existing specific Start/Stop buttons, especially Page. The old Page value is copied to Column, and Cell to Row; Page now also chooses the actual page.
- Older Select clip actions with a numeric Cell value are converted to Column/Row using Grid columns (or 8 if unset). Actions using a variable for Cell remain available as Select clip (legacy Cell index). To switch those buttons to the current action, choose Select clip and enter separate column and row values or variables.
- If you used the first Page/Column/Row test build, check the converted Select clip coordinates once. That build could shift the selection by one cell; existing Column/Row values are preserved on update.
