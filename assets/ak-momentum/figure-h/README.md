# AK-MOMENTUM: AN ACTIVATION-AWARE GRADIENT MEMORY

## Included figures

- `ak-momentum-headline.html`: the improved bar animation. Bars are 10 pixels thick, with 1.5-pixel corner radii. Their lengths directly encode the stored response after cancellation. Separate “net memory” dots are removed.
- `ak-momentum-field.html`: a separate animation in fixed input coordinates. Its colored boundary shows the buffer's response in every direction of the illustrated positive input quadrant. The axes and stored field do not rotate when the next key arrives.
- `ak-momentum-concept.svg`: the minimal static concept figure, in scalable vector format.
- `ak-momentum-concept.png`: the same static figure at 2,640 × 1,276 pixels.
- `embed.html` and `embed-field.html`: responsive embedding snippets.
- `caption.md`: suggested captions and concise mathematical notes.

Both animations are self-contained, with no external assets or network requests. Each timestep lasts 7.2 seconds through Query, Retain, and Write. The timestep and memory keep advancing. Reduced-motion preferences select a still comparison. A populated fallback is included for browsers with JavaScript disabled.

## Colors and cancellation

The top line reads δₜ = [color]. The footer says: **“Each value has a color; memory carries it forward.”**

A recurring color now denotes the same illustrative scalar error value. The six cyclic values are 0.78, 0.98, 0.91, 0.86, 0.76, and 0.94. The first three hue families match Figure A's blue, orange, and green. Colors identify values; they are not a numerical color scale. Gray denotes the shared initial memory M₀ = [0.55, 0.42].

A dot is not needed to show a total when the bar itself ends at that total. The new bar lengths are therefore the magnitude of the signed stored response, with the side of the origin indicating its sign. Matching colors do not cancel merely because their colors match: cancellation requires opposing signed contributions.

For the drawing, opposing contributions of the same color are combined first. Any remaining cancellation between different colors is distributed proportionally over the surviving side. This is an explicit color-allocation convention: a scalar sum does not have a unique decomposition into surviving colors. The total geometry is exact, but the colored portions should not be interpreted as a uniquely determined surviving contribution from each original write.

All original signed vectors remain in the numerical memory model. Display cancellation never changes a subsequent update. Very old contributions sharing a color may be combined by vector addition; this preserves their future contribution exactly by linearity.

## Bar animation

The two bars lie along the current unit key and its perpendicular. They rotate to the next viewing basis without changing the stored buffer. During retention, both methods apply their exact operator to the stored contribution vectors. During writing, the new contribution slides along the key into memory.

For β = 0.9 and η = 0.4:

| Method | Retention along the current key | Perpendicular retention | New write along the key |
| --- | --- | --- | --- |
| EMA | 0.90 | 0.90 | 0.10 δₜ |
| AK-Momentum | 0.50 | 0.90 | 0.40 δₜ |

The displayed complete update equations remain on one line. Only the emphasis changes by phase.

## Fixed-coordinate response field

For one output coordinate, the buffer is a row Mₜ. For each unit direction q = (cos θ, sin θ) in the positive input quadrant, the field's radial boundary is

\[
r_t(\theta)=M_tq,\qquad 0\leq\theta\leq\pi/2.
\]

The illustrative stream has positive responses throughout that quadrant. The plot is a polar response diagram: it represents the memory readout for all directions in this domain, rather than displaying one rotating pair of projections. The thin outer arc marks the unit scale. The dark segment along the current input ends at its stored response. The complete numerical state is the same as in the bar animation.

Contributions with the same color are combined before drawing the field. Its colored radial bands use the cancellation convention above. Their combined radial thickness is the exact stored response, sampled at one-degree intervals for the drawn curves. During Query, only the input arrow changes; the stored response field remains unchanged. During Retain and Write, the field changes according to the complete matrix update, including the coupling of the two input coordinates.

Both the animation and the static figure use the same scalar-response geometry. A radial curve r(q) = Mq is a circular arc in two input dimensions; it is not a covariance ellipse or an image of a unit circle under the retention operator.

## Static concept figure

The static figure uses exactly the response-field encoding of the fixed-coordinate animation. For a unit direction q in the positive input quadrant, a boundary point is (Mq)q. The dashed curve shows the previous response, the blue interior shows the retained response, and the green outer band shows the additive new write. Colors distinguish these update stages; the green band keeps the palette green used in the animation.

For clarity, the current unit activation is aligned with u₁, with u₂ perpendicular to it. Both methods start from the same illustrative row Mₜ₋₁ = [0.55, 0.42], and xₜ = x̂ₜ = u₁. With β = 0.9, η = 0.4, and δₜ = 0.9, the exact states are:

| Method | Retained row | New-write row | Updated row |
| --- | --- | --- | --- |
| EMA | [0.495, 0.378] | [0.090, 0] | [0.585, 0.378] |
| AK-Momentum | [0.275, 0.378] | [0.360, 0] | [0.635, 0.378] |

For every shown direction q, the green band's radial thickness is exactly

\[
(M_t-M_{\mathrm{retained}})q
=\begin{cases}
(1-\beta)\delta_t x_t^\top q,&\text{EMA},\\
\eta\delta_t\hat x_t^\top q,&\text{AK-Momentum}.
\end{cases}
\]

Thus the band adds directly to the blue radius. It is largest along the current activation and vanishes in its perpendicular direction. The multipliers beside the axes refer only to retained old memory: EMA retains β in both directions; AK retains β−η along the key and β perpendicular to it. The green term is the additive write in the retain–write form, not the full residual correction by itself.

The shapes are circular arcs clipped to the positive input quadrant. For a row M = [a,b], p = (Mq)q satisfies ||p−Mᵀ/2||² = ||M||²/4. Their geometry is therefore computed from the actual response, without imposing an ellipse. Band thickness, not band area, measures the added response. This example has nonnegative retained and new responses throughout the shown domain, so the layered decomposition is exact and needs no cancellation convention. It does not imply that arbitrary signed updates always produce an outer layer.

The previous static version instead plotted affine images of a set of test vectors. Although that is a different valid geometric construction, it did not match the response-field interpretation requested here; this version replaces it completely.

## Mathematical definitions

EMA uses the raw gradient:

\[
M_t^{\mathrm{EMA}}=\beta M_{t-1}^{\mathrm{EMA}}+(1-\beta)g_t,
\qquad g_t=\delta_tx_t^\top.
\]

AK uses the normalized activation:

\[
M_t^{\mathrm{AK}}=M_{t-1}^{\mathrm{AK}}(\beta I-\eta\hat x_t\hat x_t^\top)+\eta\delta_t\hat x_t^\top
=\beta M_{t-1}^{\mathrm{AK}}+\eta(\delta_t-M_{t-1}^{\mathrm{AK}}\hat x_t)\hat x_t^\top.
\]

The animations choose unit raw inputs, so xₜ = x̂ₜ numerically in this example. That is not an assumption in the general EMA formula. Keys are seeded pseudorandom positive mixtures in a fixed orthonormal basis (u₁,u₂), drawn from angles 4–40° with probability 3/4 and 50–86° with probability 1/4. Both methods receive identical inputs and values. Parameters and values are illustrative, not empirical measurements or tuning recommendations.

The fixed coordinate guides are not assumed to be statistical eigendirections. For independent stationary normalized inputs, let qⱼ be an eigenvector of E[x̂x̂ᵀ] with eigenvalue λ̂ⱼ. Then the displayed mean old-memory retention per eigenbasis entry is ρⱼ = β for EMA and ρⱼ = β−ηλ̂ⱼ for AK. Every output row shares the same input-side operator, so one output coordinate is sufficient here.

At matched β, old content perpendicular to the current key receives the same per-step retention in both methods. AK adds forgetting along the activation. Highly excited statistical directions therefore refresh faster; weakly excited directions retain an EMA-like horizon. The unequal write gains and different stored magnitudes are not, by themselves, proof of an optimization advantage.

## Embedding

Publish the HTML files as static blog assets. Adjust the example URL in the appropriate embed snippet. Each iframe reports its height; the parent verifies the source window. Panels sit side by side on wide screens and stack on narrow screens.

The bar root ID is `ak-memory-bars`; the field root ID is `ak-memory-field`. Each root exposes `.akMemory` with `pause()`, `play()`, `reset()`, `seek(milliseconds)`, `advance(numberOfTimesteps)`, and `state()`. Each root ID must be unique on its page.

Sources: [AK-Momentum blog](https://euijinh.github.io/posts/2026/08/ak-momentum/) and [paper, Sections 2.1 and 3.2](https://arxiv.org/html/2608.19491v1).
