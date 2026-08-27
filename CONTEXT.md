# Gisx Icon

The gisx mascot: a rounded tile and one living eye. It exists so the icon is a character — programmatic motion, fluid physics, a one-line call, still customizable — not a drawing, clip, or sprite.

## Character

**Mascot**:
The gisx icon as a character. One tile, one eye, either alive or shut.
_Avoid_: Logo, brand mark, sprite, avatar, widget, illustration

**Tile**:
The rounded square the eye lives inside. Its border is the wall the eye collides with.
_Avoid_: Background, badge, chip, container, frame

**Eye**:
The two-circle body: a shell carrying a pupil. One mass, not two independent actors.
_Avoid_: Ball, orb, emoji, face

**Shell**:
The outer circle. Short looks leave it at the centre; only a far look moves it.
_Avoid_: Sclera, white, outer (as a noun)

**Pupil**:
The inner circle. It does every glance.
_Avoid_: Inner (as a noun), black, iris

## State

**Pane State**:
The protocol value the mascot accepts whole, payload included. The mascot derives its own name from it, so a caller never converts one first.
_Avoid_: Status, mood, emotion, variant, attention state

**Pose**:
The CSS shape of a pane state — lids, offsets, scales. Pose never writes the motion layers.
_Avoid_: Clip, animation, expression, look

**Life**:
Whether the eye is simulating. Every pane state is alive except Exited, whose pose has already shut it.
_Avoid_: Idle animation, loop, playback (Idle is a pane state, not this)

## Motion

**Gaze Intent**:
A place the eye wants to look, and how long to dwell once it has arrived. A wish, not a pose: the simulation decides whether the eye can reach it. An intent past the tile is how the eye presses a wall or pools into a corner.
_Avoid_: Target, waypoint, keyframe, destination, look-at

**Wander**:
The Idle gaze. Places both inside the tile and past its border, so a corner press is rare and physical.
_Avoid_: Idle loop, idle animation

**Attend**:
The gaze of every living state that is not Idle. Short looks, shell at the centre, so the pose is what the state contributes and the pupil is what stays alive.
_Avoid_: Working animation, busy animation

**Simulation**:
The continuous physical world the eye lives in. Stretch, splat, blinks, and flinches are consequences of one clock, not clips played in sequence.
_Avoid_: Animation, timeline, tween, sequence, Lottie, GIF

**Spring**:
A mass pulled toward a rest by stiffness and slowed by damping. The mascot moves because of springs, not because of durations.
_Avoid_: Easing, curve, tween, duration

**Travel Region**:
The tile inset by the eye's own radius. The eye's rim rides the tile border; its centre cannot leave this region.
_Avoid_: Hitbox, bounds, clip path, play area

**Contact**:
How near the travel boundary the eye is.
_Avoid_: Collision (the event), overlap, touching

**Press**:
Sustained force into a surface the eye still wants to go past. Press is how the eye pools into a corner and holds the shape of the wall.
_Avoid_: Squash, squeeze, squash-and-stretch

**Impact**:
The closing speed of a fresh strike. Resting on a surface is contact, not impact.
_Avoid_: Hit, bounce, collision

**Jelly**:
The fluid deformation of the eye. It stretches along velocity, splats against a wall, rings after an impact, and snaps back when it peels off. Area is preserved, so the mascot never gains visual weight.
_Avoid_: Morph, blob, scale, squash (squash is one axis of jelly)

**Drift**:
The small never-still motion of a living eye. Without it a settled eye is a frozen picture.
_Avoid_: Noise, jitter, idle (Idle is a pane state)

**Blink**:
A lid closure on the same clock as the rest of the simulation, so it can happen mid-glance.
_Avoid_: Wink, fade, blink animation

**Flinch**:
A fast partial blink caused by a hard corner impact.

## Use

**Wiring**:
The intended call: pass the pane state whole. The mascot normalises names, payloads, size, gaze, and colour itself.
_Avoid_: Adapter, mapper, converter, wrapper

**Config**:
Caller-chosen look that is not pane state. Colour is config; where the eye looks is a gaze override. Neither invents a new pane state.
_Avoid_: Theme, skin, settings, options, style

**Customization**:
What a caller may change without forking: size, colour, accessible name, and the places the eye looks while it is alive. Physics stays the mascot's.
_Avoid_: Theming, restyling, skinning, forking
