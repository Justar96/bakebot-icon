# Gisx Icon

The gisx mascot: a tile of any shape and two living eyes. It exists so the icon is a character — programmatic motion, fluid physics, a one-line call, still customizable — not a drawing, clip, or sprite.

## Character

**Mascot**:
The gisx icon as a character. One tile, two eyes, either alive or shut.
_Avoid_: Logo, brand mark, sprite, avatar, widget, illustration

**Tile**:
The shape the eyes live inside. Its border is where the face has turned as far as it turns, and the edge that clips what hangs over.
_Avoid_: Background, badge, chip, container, frame

**Shape**:
Which tile: a rounded rectangle given as two half extents and a corner radius. Six are named — square, rounded, squircle, circle, pill, card — and a caller may give their own. Names are shorthand for values, not modes the mascot knows about: nothing in the simulation asks which shape it is in.
_Avoid_: Variant, preset, mode, mask, silhouette

**Eyes**:
The pair: two discs on a shared sphere. One mass moved by one simulation, not two independent actors — a state squints both or neither.
_Avoid_: Ball, orb, emoji, eye (singular — there is no one eye)

**Disc**:
One of the two. It carries what happens about its own centre: how foreshortened the turn leaves it, and how far the lid has closed it.
_Avoid_: Pupil, dot, circle, iris

**Deadzone**:
How near a look may be before the eyes do not move for it at all. Past it, the distance is answered by the difference rather than by the whole of it, so a glance just clear of the deadzone is a small movement and not a jump. With no pupil to spend a short look on, this is what keeps a glance from being a turn.
_Avoid_: Threshold, tolerance, snap zone

## State

**Pane State**:
The protocol value the mascot accepts whole, payload included. The mascot derives its own name from it, so a caller never converts one first.
_Avoid_: Status, mood, emotion, variant, attention state

**Pose**:
The shape a pane state holds — offsets and scales for the eyes' travel layer and for the pair itself, each state written as a departure from rest. It belongs to the character, not to a stylesheet: a renderer applies it, and every renderer applies the same one. Pose never writes the motion layers.
_Avoid_: Clip, animation, expression, look, CSS state (it is data, and a renderer chooses how to apply it)

**Entrance**:
The one-shot a state plays on arrival rather than holds — the attention settle, the notified blink. Not a pose: it has no resting value, so it stays with whichever renderer can express it.
_Avoid_: Pose, transition, keyframe (a keyframe is how one renderer spells it)

**Life**:
Whether the eyes are simulating. Every pane state is alive except Exited, whose pose has already shut it.
_Avoid_: Idle animation, loop, playback (Idle is a pane state, not this)

## Motion

**Gaze Intent**:
A place the eyes want to look, and how long to dwell once they have arrived. A wish, not a pose: the simulation decides whether they can reach it. Past the travel region, distance becomes direction rather than force — every intent that way resolves to the same full turn before the spring moves.
_Avoid_: Target, waypoint, keyframe, destination, look-at

**Wander**:
The Idle gaze. Places both inside the tile and past its border, so a full turn of the face is rare and earned.
_Avoid_: Idle loop, idle animation

**Attend**:
The gaze of every living state that is not Idle. Short looks that stay well inside the tile, so the pose is what the state contributes and the glance is what stays alive.
_Avoid_: Working animation, busy animation

**Simulation**:
The continuous physical world the eyes live in. Stretch, drift, blinks, and the turn of the face are consequences of one clock, not clips played in sequence.
_Avoid_: Animation, timeline, tween, sequence, Lottie, GIF

**Spring**:
A mass pulled toward a rest by stiffness and slowed by damping. The mascot moves because of springs, not because of durations.
_Avoid_: Easing, curve, tween, duration

**Travel Region**:
The tile inset by the pair's reach less its overshoot — for a rounded rectangle, another one with both halves and the radius reduced by the same amount. The pair's centre cannot leave this region; a disc's rim hangs the same distance past the tile border in every shape, at any turn. It is a limit, not a wall: reaching it is a full turn, not a hit.
_Avoid_: Hitbox, bounds, clip path, play area, wall

**Overshoot**:
How far past the tile's border a disc's rim may go before the tile cuts it off. An eye whose rim stopped exactly on the border is always whole and always fully visible, which reads as a ball inside a box; a real eye at the far end of its travel goes round the side of the head and part of it stops being there. The tile is both the border and the clip, from the same numbers.
_Avoid_: Padding, margin, bleed, cropping (the eyes are cut by the tile, not by the frame)

**Containment**:
Holding the pair inside its travel region: put back on the boundary, and only the part of the velocity that was leaving taken away. Nothing rebounds and nothing is scrubbed off, so the face slides along the border instead of stopping dead against it.
_Avoid_: Collision, bounce, restitution, friction, impact

**Turn**:
Which way the face is looking, as a yaw and a pitch in degrees, read off how far the pair has travelled — full turn at the border. It is why the eyes going wide is a face looking rather than a ball resting against a wall. One value, so a renderer never decides for itself what looking left means.
_Avoid_: Direction, heading

**Foreshortening**:
What a turn does inside the pair. The two discs are points on a sphere, recentered around their shared midpoint so the simulation remains the pair's only translation. Their local surface axes are projected into the render plane, so yaw and pitch continuously rotate and narrow each ellipse together. The narrow axis stops at half width at the silhouette, and the tile leaves at least half of that drawn eye visible at every reachable edge angle. Those cues make a flat face read as turned without letting one eye disappear.
_Avoid_: Perspective camera, Z layer, skew, squash

**Eye Contact**:
The non-penetration constraint between the two projected discs. Their rotated ellipse extents are measured along the full centre-to-centre axis, then both are moved equally apart while their midpoint stays fixed. Pitch may make that axis diagonal or vertical; contact follows it rather than resolving on X alone. No bounce — it is a geometric limit with a four-view-unit minimum seam.
_Avoid_: Horizontal clamp, repulsion, bounce, independent eye physics

**Contact**:
How near the travel boundary the pair is — how fully the face has turned. It buys nothing kinetic; it is the blend between the two jelly springs, so a look being held settles instead of ringing on.
_Avoid_: Collision, overlap, touching, press

**Jelly**:
The fluid deformation of the pair. It stretches along the way it is travelling and rings as it settles. Area is preserved, so the mascot never gains visual weight.
_Avoid_: Morph, blob, scale, squash (squash is one axis of jelly)

**Drift**:
The small never-still motion of living eyes. Without it a settled mascot is a frozen picture.
_Avoid_: Noise, jitter, idle (Idle is a pane state)

**Settle**:
What a reader who asked for less motion may get instead of a stopped mascot: the eyes alive inside a widened deadzone, drift and lids only, nothing crossing the tile or deforming. The ordinary simulation on quieter dials, not a second one.
_Avoid_: Reduced motion (that is the preference, not the behaviour), static, paused, disabled

**Blink**:
A lid closure on the same clock as the rest of the simulation, so it can happen mid-glance.
_Avoid_: Wink, fade, blink animation

**Drawing Geometry**:
The tile rect — which is also the shape the eyes are clipped to — the sphere the pair sits on, the radius of a disc, the square they are measured in, and what a shut lid looks like. Everything a renderer needs and the simulation never does, resolved from the same shape the eyes are actually bounded by — so a second renderer draws this mascot rather than one that resembles it, whatever shape it is in.
_Avoid_: Layout, viewBox, dimensions, sprite, asset

**Mascot (the driver)**:
The character with no renderer attached: one clock, the gaze scheduler, the blink cadence, and a readable pose. A renderer calls it and writes what it reads, so a second renderer gets the same character rather than a second version of one.
_Avoid_: Engine, controller, store, machine

**Pose (the readout)**:
What the driver hands a renderer for one frame, already interpolated between fixed steps. Distinct from the CSS Pose of a pane state, which writes different elements.
_Avoid_: Frame, snapshot, state (the simulation's own word is Simulation)

**Tuning**:
The dials a caller may turn on the motion: the three springs, how much the pair squishes, how restless it is, how often it blinks, and how near a look may be before the eyes ignore it. A spring is named by frequency and damping ratio rather than stiffness and damping, because those can be clamped into a region the integrator is provably stable in.
_Avoid_: Physics config, spring config, easing, preset

**Seed**:
What makes one mascot's run reproducible, and what makes two mascots on a page different from each other. A seed alone is not enough for the second: each mascot also offsets its own clock, because drift and tremor are functions of time rather than of the random stream.
_Avoid_: Random, id, key, instance

## Use

**Wiring**:
The intended call: pass the pane state whole. The mascot normalises names, payloads, size, gaze, and colour itself.
_Avoid_: Adapter, mapper, converter, wrapper

**Config**:
Caller-chosen look that is not pane state. Colour is config; where the eyes look is a gaze override. Neither invents a new pane state.
_Avoid_: Theme, skin, settings, options, style

**Customization**:
What a caller may change without forking: size, colour, accessible name, the shape of the tile, the places the eyes look while they are alive, the seed of its run, and the tuning of its motion. The physics is still the mascot's — tuning moves dials inside a stable region, it does not hand a caller the integrator.
_Avoid_: Theming, restyling, skinning, forking
