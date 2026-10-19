---
title: 'AK-Momentum'
description: 'Rethinking Momentum as an Activation-Keyed Associative Memory'
date: 2026-08-19
permalink: /posts/2026/ak-momentum/
authors:
  - name: Euijin Hong
    url: /
    affiliation: CMU
  - name: Guannan Qu
    affiliation: CMU
venue: 'NeurIPS 2026 Main Track (Poster)'
thumbnail: /assets/ak-momentum/figure-h/ak-momentum-concept.png
tags:
  - AK-Momentum
  - DeltaMomentum
  - ML Optimizers
  - Associative Memory
---

\[[Paper](https://arxiv.org/abs/2608.19491v2)\] \[[Code](https://github.com/euijinh/ak-momentum)\] \[[BibTeX](#bibtex)\]

> Conventional momentum forgets past gradients uniformly across input directions. **Activation-Keyed Momentum (AK-Momentum)** instead treats momentum as an associative memory of input activations and output-side errors, using the delta rule to selectively refresh stored associations, yielding direction-dependent forgetting and implicit input-side preconditioning.
> 

<figure id="ak-momentum-headline" class="d-figure">
  <div class="d-figure__grid">
    <div>
      <div class="d-figure__label">(a) Memory update</div>
      <div class="d-figure__frame"><img src="{{ site.baseurl }}/assets/ak-momentum/figure-h/ak-momentum-concept.svg" width="1152" height="557" alt="Two response-field diagrams of one memory update. EMA momentum retains β of old memory along both input axes, u₁ and u₂, and adds a thin new write along u₁. AK-Momentum retains β − η along the current input u₁ and β along u₂, and adds a thicker new write along u₁. A dashed curve marks memory before the update, blue the retained memory, and green the new write; β = 0.9, η = 0.4, δₜ = 0.9, Mₜ₋₁ = [0.55, 0.42]."></div>
    </div>
    <div>
      <div class="d-figure__label">(b) 67M pretraining</div>
      <div class="d-figure__frame d-figure__frame--match" style="--match-aspect: 864 / 417.6"><img src="{{ site.baseurl }}/assets/ak-momentum/figure-b/figure-b1.png" width="1439" height="997" alt="Validation loss versus optimizer step for the 67M model. AK-AdamW stays below AdamW from step 2,000 to 19,000, ending near 2.75 against about 2.83 for AdamW."></div>
    </div>
  </div>
  <figcaption><b>(a) Activation-aware memory in fixed input coordinates.</b> Each radius is the stored response along a unit input direction. The dashed curve shows memory before the update, blue shows retained memory, and the green band’s radial thickness is the additive new write. With the current unit activation aligned with $u_1$, EMA retains $\beta$ of old memory along both axes; AK retains $\beta-\eta$ along $u_1$ and $\beta$ along its perpendicular $u_2$. The green band is largest along $u_1$ and vanishes along $u_2$. Both methods start from the same memory and use identical input and error. The circular arcs follow the exact scalar response; they are not covariance ellipses. <b>(b)</b> FineWeb-Edu validation loss of the 67M model versus optimizer steps, summarizing three seeds. AK-AdamW reaches matched validation-loss levels in 39.25% fewer steps on average.</figcaption>
</figure>

## **The Memory Horizon Gap**

Conventional momentum maintains an exponentially weighted memory of past gradients:

$$
M_t^{\mathrm{EMA}}
=\beta M_{t-1}^{\mathrm{EMA}}+(1-\beta)g_t.
$$

The coefficient $\beta$ controls how quickly old information fades. Consequently, **every direction in the existing memory decays by the same factor $\beta$.** 

But neural-network activations are mostly not uniformly distributed. Some input directions are encountered frequently, providing repeated opportunities to refresh the stored information. Other directions are encountered less often, requiring longer retention of the memory.

Yet conventional momentum forgets the old information for all directions at the same rate, regardless of how frequently each is observed.

> Can we leverage the information within the incoming gradient itself to decide which part of momentum's memory to refresh?
> 

## **Momentum as Associative Memory**

AK-Momentum resolves this tension by treating the momentum buffer as an associative memory and redesigning its update rule. 

Consider a linear layer $y=Wx$. For a single training example, its weight gradient naturally factorizes into two components:

$$
g_t=\delta_t x_t^\top,
$$

where $x_t$ is the input activation and $\delta_t=\partial\mathcal{L}/\partial y_t$ is the backpropagated error.

This suggests a different interpretation of momentum: a matrix-valued **associative memory**, with the input activation as its *key* and the output-side error as its *value*. Given an input key, the memory predicts the corresponding error.

AK-Momentum updates this memory using the classical **delta rule**:

$$
M_t=\beta M_{t-1}
+\eta\bigl(\delta_t-M_{t-1}\hat{x}_t\bigr)\hat{x}_t^\top.
$$

Here, $\hat{x}_t=x_t/\lVert x_t\rVert_2$ is the normalized input activation, and $\eta$ controls the memory correction separately from the model's learning rate.

The update performs three simple operations:

1. **Read:** Retrieve the stored prediction $M_{t-1}\hat{x}_t$ for the current input.
2. **Compare:** Measure its error against the observed output-side error, $\delta_t-M_{t-1}\hat{x}_t$.
3. **Correct:** Write this prediction error back along the current input direction.

Expanding the update reveals the key difference from conventional momentum:

$$
\begin{aligned}
M_t={}&
\underbrace{\beta M_{t-1}}_{\text{Global decay}}\
&+\underbrace{\eta\delta_t\hat{x}_t^\top}_{\text{New information}}\
&-\underbrace{\eta(M_{t-1}\hat{x}_t)\hat{x}_t^\top}_{\text{Key-aligned removal}}.
\end{aligned}
$$

The last term removes a portion of the old information associated with the current input, rather than uniformly forgetting the entire buffer.

For example, when the current key points along a unit direction $u$, old information along $u$ is retained with factor $\beta-\eta$, while information along an orthogonal direction $v$ retains the ordinary factor $\beta$.

**Repeatedly queried directions are therefore refreshed more aggressively.** Directions that are rarely queried receive fewer such corrections, although they still undergo global decay.

<figure id="ak-momentum-figure-a" class="d-figure l-page">
  {% include figure-a-embed.html %}
  <figcaption><b>Activation-keyed memory update.</b> The colored field shows the stored readout in every direction of the illustrated input quadrant: its radius along a unit direction $q$ is $M_{t} q$. Only the query arrow moves when a new input arrives; the field changes when memory is retained or updated. This shows the coupled effect of mixed inputs without rotating the coordinate system.</figcaption>
</figure>

## **What Is Momentum Actually Learning?**

Conventional EMA momentum can be interpreted as estimating the population gradient by minimizing a weight-space prediction objective:

$$
J_w(M)=\frac12\mathbb E\left[||M-g||_F^2\right].
$$

It asks: **How well does the buffer approximate the observed gradients?**

AK-Momentum takes a different perspective. For a linear layer, the effect of a simple momentum-SGD weight update $\Delta W=-\alpha M$ on its output, at fixed input $x$, is

$$
\Delta y=\Delta W x=-\alpha Mx.
$$

This motivates learning the buffer through its predictions in the layer's output space, rather than solely through its distance from gradient matrices.

For the normalized-key update, AK-Momentum performs online stochastic-gradient steps on the regularized objective

$$
J_{\mathrm{AK}}(M)=
\frac12\mathbb E\left[||\delta-M\hat{x}||_2^2\right]
+\frac{\mu}{2}||M||_F^2,
\qquad
\mu=\frac{1-\beta}{\eta}.
$$

The first term trains the memory to predict output-side errors from incoming activations; the second arises from the global decay and stabilizes the estimate.

**EMA learns to approximate gradients in weight space. AK-Momentum learns a regularized input-to-error association in function space.**

This difference is also what gives rise to the implicit input-side correction discussed below. In AK-AdamW, the resulting memory replaces AdamW's first-moment buffer; AdamW's second-moment normalization remains in the parameter update.

## **Empirical Results**

### **Language-Model Pretraining**

We evaluate AK-Momentum by replacing AdamW's first-moment update with the proposed rule, resulting in **AK-AdamW**.

Using Llama-2-style transformers pretrained on FineWeb-Edu, we compare AK-AdamW with AdamW under paired training configurations. Both optimizers share the model initialization, data order, and training schedule, with optimizer hyperparameters tuned at 67M and transferred to larger widths using maximal-update parameterization ($\mu$P).

AK-AdamW consistently reaches matched validation-loss levels in fewer steps:

<figure id="ak-momentum-table-steps" class="d-table" markdown="1">
<div class="d-table__wrap" markdown="1">

| Model | Training tokens | Seeds | Mean step reduction |
| --- | --- | --- | --- |
| 67M | 10B | 3 | **39.25%** ± 4.55 pp |
| 370M | 10B | 3 | **17.61%** ± 0.95 pp |
| 1B | 20B | 1 | **13.43%** |

</div>
<figcaption><b>AK-AdamW step reduction relative to AdamW.</b> The step reductions are averaged over matched validation-loss levels within the reported measurement window. The uncertainties are standard deviations across seeds, in percentage points (pp), while the 1B experiment serves as a single-seed scale check.</figcaption>
</figure>

The improvements persist across the evaluated training trajectories, with AK-AdamW also reaching lower final validation loss at all three scales.

<figure id="ak-momentum-figure-b" class="d-figure l-page">
  <div class="d-figure__grid d-figure__grid--3">
    <div>
      <div class="d-figure__label">(a) 67M</div>
      <div class="d-figure__frame"><img src="{{ site.baseurl }}/assets/ak-momentum/figure-b/figure-b1.png" width="1439" height="997" loading="lazy" alt="Validation loss versus optimizer step for the 67M model. AK-AdamW stays below AdamW from step 2,000 to 19,000, ending near 2.75 against about 2.83 for AdamW."></div>
    </div>
    <div>
      <div class="d-figure__label">(b) 370M</div>
      <div class="d-figure__frame"><img src="{{ site.baseurl }}/assets/ak-momentum/figure-b/figure-b2.png" width="1439" height="997" loading="lazy" alt="Validation loss versus optimizer step for the 370M model. AK-AdamW stays below AdamW from step 2,000 to 19,000, ending near 2.41 against about 2.44 for AdamW."></div>
    </div>
    <div>
      <div class="d-figure__label">(c) 1B</div>
      <div class="d-figure__frame"><img src="{{ site.baseurl }}/assets/ak-momentum/figure-b/figure-b3.png" width="1439" height="997" loading="lazy" alt="Validation loss versus optimizer step for the 1B model. AK-AdamW stays below AdamW from step 3,000 to about 38,000; both end near 2.23, with AK-AdamW slightly lower."></div>
    </div>
  </div>
  <figcaption><b>FineWeb-Edu validation loss versus optimizer steps.</b> AK-AdamW reaches matched loss levels earlier than AdamW across all three evaluated model sizes. The 67M and 370M curves <b>(a, b)</b> summarize three seeds; the 1B comparison <b>(c)</b> uses one seed.</figcaption>
</figure>

### Efficiency and Computational Overhead

**Fewer optimization steps do not necessarily mean less training time.** AK-Momentum performs additional memory-correction operations, so each training step is more expensive.

In our updated per-step measurements, the additional FLOP costs are approximately **10.00%, 15.54%, and 18.12%** at 67M, 370M, and 1B, respectively. The corresponding measured wall-clock overheads are **15.26%, 17.75%, and 18.44%**.

The practical question is whether improved convergence compensates for this overhead.

In the reported single-seed wall-clock comparisons at 67M and 370M, AK-AdamW initially trails AdamW but eventually crosses over, reaching matched validation-loss levels sooner after the saved steps outweigh their additional cost.

<figure id="ak-momentum-figure-c" class="d-figure l-page">
  <div class="d-figure__grid d-figure__grid--2">
    <div>
      <div class="d-figure__label">(a) 67M</div>
      <div class="d-figure__frame"><img src="{{ site.baseurl }}/assets/ak-momentum/figure-c/figure-c1.png" width="1437" height="997" loading="lazy" alt="Validation loss versus cumulative wall-clock time for the 67M model over about 18 hours. AK-AdamW starts marginally above AdamW, crosses below it shortly afterwards, and ends near 2.77 against about 2.80 for AdamW."></div>
    </div>
    <div>
      <div class="d-figure__label">(b) 370M</div>
      <div class="d-figure__frame"><img src="{{ site.baseurl }}/assets/ak-momentum/figure-c/figure-c2.png" width="1439" height="997" loading="lazy" alt="Validation loss versus cumulative wall-clock time for the 370M model over about 46 hours. The two curves start together; AK-AdamW then stays below AdamW and ends near 2.42 against about 2.43 for AdamW."></div>
    </div>
  </div>
  <figcaption><b>Validation loss versus cumulative training time.</b> AK-AdamW incurs additional computation from the beginning, but its faster convergence eventually offsets this overhead in the reported 67M <b>(a)</b> and 370M <b>(b)</b> comparisons.</figcaption>
</figure>

Importantly, AK-Momentum requires **no additional persistent optimizer-state buffers** beyond the base optimizer, although its correction introduces temporary-memory and computational costs.

## **Why It Helps: Theory and Diagnostics**

The analysis identifies three closely related consequences of the activation-keyed update.

### **1. Direction-Dependent Memory Horizons**

The input key determines which components of old memory receive additional correction.

Let $\hat{\Sigma}=\mathbb E[\hat{x}\hat{x}^{\top}]$ be the normalized-key second-moment matrix, with eigenvalues $\hat{\lambda}_i$. Under independent, stationary keys, old information along each eigendirection has expected retention factor

$$
\tilde{\beta}_i=\beta-\eta\hat{\lambda}_i.
$$

For nonnegative retention factors, the corresponding effective memory horizon is

$$
\tau_i=\frac{1}{(1-\beta)+\eta\hat{\lambda}_i}.
$$

Thus, **directions receiving more input excitation have shorter memory horizons**, while weakly excited directions retain a longer, EMA-like history.

This is the mathematical generalization of the two-direction example: forgetting adapts to the distribution of incoming activations.

### **2. Implicit Input-Side Correction**

Under fixed input statistics and the stability conditions of the analysis, the expected momentum buffer approaches

$$
M^*=\hat{G}(\mu I+\hat{\Sigma})^{-1},
$$

where $\hat{G}=\mathbb E[\delta\hat{x}^{\top}]$ and $\mu=(1-\beta)/\eta$.

This is a **Tikhonov-regularized Wiener predictor** of output-side errors from normalized input keys.

Viewed as a parameter-update buffer, the same expression applies an implicit input-side correction: directions with larger input second-moment eigenvalues receive relatively smaller scaling.

This resembles the input-side component of structured preconditioning methods such as K-FAC, but arises directly from the momentum recurrence—**without explicitly computing or inverting a preconditioning matrix at each step**.

### **3. Faster Adaptation to Changing Gradients**

As training progresses, both gradients and input statistics change. A momentum buffer must therefore adapt to new information while retaining useful history.

The analysis shows that AK-Momentum can contract expected tracking error toward its evolving target faster than EMA along excited input directions, under the specified tracking assumptions. In simplified optimization dynamics, it also establishes faster per-direction convergence in particular oscillatory regimes.

These results characterize the memory mechanism and its potential optimization benefits; they do not imply universally faster convergence for arbitrary nonconvex networks.

### **Do the Observations Support This Explanation?**

We additionally measure the behavior of the momentum buffer and intermediate representations during 67M language-model training.

Compared with AdamW, AK-AdamW exhibits stronger momentum–gradient alignment, lower relative buffer–gradient error, and better alignment between the memory's predicted and observed output-side errors.

The learned input features also show lower covariance condition numbers, higher effective rank, and less variance concentrated in the leading direction.

<figure id="ak-momentum-figure-d" class="d-figure">
  <div class="d-figure__grid d-figure__grid--2">
    <div>
      <div class="d-figure__label">(a) Buffer–gradient error</div>
      <div class="d-figure__frame"><img src="{{ site.baseurl }}/assets/ak-momentum/figure-d/mom_grad_error_mean.svg" width="220" height="165" loading="lazy" alt="Mean buffer–gradient prediction error versus training step. Both optimizers start near 1.6. AdamW keeps returning to spikes of about 1.2 to 1.3 throughout training, while AK-AdamW settles near 1.03 in the second half."></div>
    </div>
    <div>
      <div class="d-figure__label">(b) Leading-direction variance</div>
      <div class="d-figure__frame"><img src="{{ site.baseurl }}/assets/ak-momentum/figure-d/feat_cov_top1_var_frac_max.svg" width="220" height="165" loading="lazy" alt="Largest fraction of input-feature variance in the leading covariance direction versus training step. AdamW rises to about 0.7 within the first few thousand steps and stays there; AK-AdamW drops to about 0.22 early and then remains between about 0.35 and 0.48."></div>
    </div>
  </div>
  <figcaption><b>Mechanistic diagnostics during 67M pretraining.</b> <b>(a)</b> The buffer–gradient prediction error is lower under AK-AdamW, while <b>(b)</b> the input-feature covariance exhibits less concentration in its leading direction. Both observations are consistent with the proposed mechanism.</figcaption>
</figure>

Together, these findings support the memory-based interpretation. They do not, by themselves, isolate the causal contribution of each mechanism to the observed optimization gains.

## **Takeaways and Open Questions**

**Momentum need not simply average past gradients.** By exploiting their natural input–error factorization, we can design a memory update that selectively refreshes stored associations according to the inputs encountered during training.

AK-Momentum develops this idea through a delta-rule correction, connecting associative memory, direction-dependent forgetting, and implicit input-side preconditioning within a single optimizer buffer.

Our experiments show encouraging improvements in the evaluated language-model and CIFAR-10 settings, but several questions remain open: whether the gains persist at substantially larger scales and in other training regimes; how AK-Momentum interacts with structured optimizers such as Muon, Shampoo, or SOAP; and whether more efficient fused implementations can further reduce its computational overhead.

More broadly, this work suggests that **the input–error factorized gradient can inform not only how parameters are updated, but also how an optimizer remembers and refreshes information.**


## **Paper and citation**
{: #bibtex}

The [full paper](https://arxiv.org/abs/2608.19491v2) provides the proofs, additional diagnostics, experimental settings, and hyperparameter studies. Questions about the work can be directed to [Euijin Hong](mailto:ehong@andrew.cmu.edu).

```bibtex
@misc{hong2026activationkeyed,
  title         = {Activation-Keyed Momentum: An Anisotropic Momentum Update via the Delta Rule},
  author        = {Euijin Hong and Guannan Qu},
  year          = {2026},
  eprint        = {2608.19491},
  archivePrefix = {arXiv},
  primaryClass  = {cs.LG},
  url           = {https://arxiv.org/abs/2608.19491}
}
```

*An earlier version used the name DeltaMomentum; the current name is Activation-Keyed Momentum.*

*Acknowledgments. This work is supported by NSF Grants 2339112 and 2512805, Jane Street, and the Pennsylvania Infrastructure Technology Alliance.*
