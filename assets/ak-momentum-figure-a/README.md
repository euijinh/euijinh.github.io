# Figure A — Refresh the direction you see

This is an original, editable illustration of the normalized-key AK-Momentum update in the project-page draft. It includes a self-contained interactive animation, a 28-second video and GIF, and static vector/PNG fallbacks.

## Files

| File | Role |
| --- | --- |
| `ak-momentum-figure-a.html` | Preferred interactive figure. Play/pause, replay, scrub, jump between stages, switch the queried direction, or inspect repeated queries. Works offline. |
| `ak-momentum-figure-a.mp4` | 1200 × 840 H.264 video, 24 fps, 28 seconds, silent. The first 16 seconds show one update; the remaining 12 show old-memory retention under repeated queries. |
| `ak-momentum-figure-a.gif` | Looping 960 × 672 preview, 10 fps. Use the HTML or video on the website when playback controls are desirable. |
| `ak-momentum-figure-a.svg` / `.png` | Main static Figure A, showing the completed update. PNG is 2400 × 1680. |
| `ak-momentum-figure-a-mobile.svg` / `.png` | Vertically arranged static fallback for narrow screens. PNG is 1280 × 2180. |
| `ak-momentum-figure-a-storyboard.svg` / `.png` | The four operations shown together, useful as an alternative static Figure A. PNG is 2400 × 2000. |
| `ak-momentum-figure-a-repeated.svg` / `.png` | Optional companion still: retention of initial memory after six queries of the same direction. PNG is 2400 × 1680. |
| `figure-a-embed.html` | A copyable Jekyll/HTML insertion with a static-first fallback and automatic iframe sizing. |
| `source/figure-a.js` | Exact recurrence, numerical example, and SVG renderer shared by every output. |
| `source/build.js` | Rebuilds the self-contained HTML and SVG/PNG stills. Requires Node.js and `sharp`. |
| `source/render-motion.js` | Rebuilds the MP4/GIF. Requires Node.js, `sharp`, and FFmpeg. |

## What the visual means

The main animation follows this exact update:

\[
M_t=\beta M_{t-1}+\eta(\delta_t-M_{t-1}\hat x_t)\hat x_t^\top.
\]

It uses two orthonormal unit input directions, \(u\) and \(v\), and one scalar output component. The plotted vector represents one row of the momentum buffer expressed in this input basis. Its coordinates are the predictions obtained by querying \(u\) and \(v\). It is not a plot of the activations themselves, a loss landscape, or a parameter trajectory.

The numerical example is deliberately simple:

\[
\beta=0.90,\qquad \eta=0.40,\qquad \delta_t=0.50,\qquad
M_{t-1}u=M_{t-1}v=1.
\]

These are illustrative values, not the paper's experimental hyperparameters or measured training results.

With \(\hat x_t=u\), the exact stages are:

| Operation | Queried component \(u\) | Perpendicular component \(v\) |
| --- | --- | --- |
| Read the original buffer | 1.00 | 1.00 |
| Apply global decay | 0.90 | 0.90 |
| Remove the key-aligned old contribution | 0.90 − 0.40 = 0.50 | 0.90 |
| Write the observed value | 0.50 + 0.40 × 0.50 = 0.70 | 0.90 |

Blue represents retained old memory, green represents the new write, and the orange arrow represents the additional removal. The offset orange arrow is a displacement annotation parallel to the queried direction. Bar lengths and vector coordinates use the same numerical units.

The removal uses the **original** prediction \(M_{t-1}\hat x_t\), which is read before decay. Consequently, old memory along the key is multiplied by \(\beta-\eta\), **not** \(\beta(1-\eta)\). The perpendicular direction still receives global decay \(\beta\). The animation's stages are an algebraic decomposition of one update, not four optimizer steps. The Read stage includes the comparison with the observed error; decay, removal, and writing expand the draft's Correct operation. Smooth transitions between stages are explanatory interpolation, and the repeated-key view labels an in-progress update separately from a completed query.

Equivalently, for the queried direction and its perpendicular counterpart,

\[
M_tu=(\beta-\eta)M_{t-1}u+\eta\delta_t,
\qquad M_tv=\beta M_{t-1}v.
\]

Switching the input key to \(v\) swaps these roles. This makes the dependence on the incoming activation visible without changing the coefficients.

## What the repeated-key view means

This view tracks only the tagged contribution of the **initial** buffer. Newly written content is excluded from the displayed contribution; it is not a simulation in which AK-Momentum stops writing new information.

Starting with unit coefficients and repeatedly querying \(u\), after \(n\) updates:

\[
C_n^{(u),\mathrm{AK}}=(\beta-\eta)^n,
\qquad C_n^{(v),\mathrm{AK}}=\beta^n,
\qquad C_n^{(u),\mathrm{EMA}}=C_n^{(v),\mathrm{EMA}}=\beta^n.
\]

At \(n=6\), the queried initial-memory coefficient is \(0.5^6=0.015625\) for AK-Momentum, while the perpendicular coefficient and both EMA coefficients are \(0.9^6=0.531441\). The figure displays these as 0.016 and 0.531. This comparison concerns old-memory retention, not total buffer magnitude, prediction accuracy, or optimizer convergence speed.

For an orthogonal sequence of \(u\) and \(v\) keys, if \(u\) is queried \(k\) times in \(N\) updates, its tagged initial-memory coefficient is \(\beta^{N-k}(\beta-\eta)^k\). This makes the connection between query frequency and forgetting explicit.

The visual uses \(0<\eta\leq\beta<1\), so the retention factors remain nonnegative. It illustrates a single normalized key per update. In the deployed batch rule, the corresponding outer products are averaged over keys; that batch operation is not separately animated here.

## Recommended caption

**Figure A. Refreshing a stored association.** An input along \(u\) selects the corresponding association in the momentum buffer. Ordinary decay first acts on all directions; the delta-rule correction removes an additional key-aligned contribution and writes the new value along that same direction. Blue denotes retained old memory and green denotes newly written content. Old information is retained with factor \(\beta-\eta\) along \(u\), while information along the perpendicular direction \(v\) retains the ordinary decay factor \(\beta\). The illustration uses a single output component and illustrative parameters \(\beta=0.9\), \(\eta=0.4\), and \(\delta=0.5\). The repeated-key view isolates the contribution of the initial memory; new writes are excluded from that view.

For the static main figure alone, omit the final sentence about the repeated-key view.

## Alt text

AK-Momentum updates a two-component memory initially equal to (1, 1). With input key u, global decay gives (0.9, 0.9); selective removal gives (0.5, 0.9); writing 0.2 along u gives (0.7, 0.9). Blue shows retained old memory, green shows the new write, and an orange arrow shows key-specific removal. The perpendicular v component still decays by beta.

## Place it on the project page

1. Copy the assets into `/assets/ak-momentum/figure-a/` in the website repository. The interactive HTML has no external font, script, or data dependencies.
2. Insert the contents of `figure-a-embed.html` at the Figure A placeholder. The snippet initially shows the static figure. It reveals the interactive figure only after receiving its sizing message, so failed scripts or failed iframe loads leave the still visible.
3. For readers who prefer reduced motion, the still stays visible until they choose to open the interactive figure. The interactive figure itself starts paused under that preference.
4. If only a static figure is desired, use the SVG with the PNG as a download alternative. Use the supplied mobile layout in a `<picture>` source for narrow screens.

The embed snippet's asset paths assume the website is hosted at the domain root, as at `euijinh.github.io`. If the folder changes, update the paths and `data-asset-base` together.

A video-only alternative is:

```html
<video controls muted loop playsinline preload="metadata"
  poster="/assets/ak-momentum/figure-a/ak-momentum-figure-a.png"
  style="display:block;width:100%;height:auto">
  <source src="/assets/ak-momentum/figure-a/ak-momentum-figure-a.mp4" type="video/mp4">
  <a href="/assets/ak-momentum/figure-a/ak-momentum-figure-a.png">View the static figure</a>
</video>
```

## Rebuild

From this folder, with `sharp` installed in the Node environment:

```sh
node source/build.js
node source/render-motion.js /absolute/path/to/temporary-frames
```

The video renderer writes temporary frames to the supplied directory. The SVG renderer is the shared source of truth for the interactive, static, and motion outputs. Intermediate animation states interpolate between exact algebraic endpoints.

## Checks and references

The four single-update endpoints, both queried directions, and the repeated-key coefficients were checked numerically. The two directional identities were also checked against the original matrix recurrence for 100 random orientations and multi-output buffers. Desktop/mobile SVG text bounds and representative stills/video frames were inspected. Playback, scrubbing, stage selection, key selection, mode switching, reduced-motion behavior, and the animation clock were exercised in an event-driven DOM harness.

Mathematical source: the supplied AK-Momentum v2 paper, Sections 2–3 and Appendix L, and the current project-page draft. [Paper](https://arxiv.org/abs/2608.19491v2).

Conceptual reference: Songlin Yang's [DeltaNet Explained, Part I](https://sustcsonglin.github.io/blog/2024/deltanet-1/) for the associative-memory read/erase/write explanation, and [Part III](https://sustcsonglin.github.io/blog/2024/deltanet-3/) for the normalized-key directional interpretation. The drawings and code here are original. AK-Momentum's separate global decay is retained explicitly; the DeltaNet special case with unit global retention is not substituted for it.
