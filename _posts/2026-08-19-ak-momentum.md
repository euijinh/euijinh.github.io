---
title: 'AK-Momentum'
description: 'Rethinking Momentum as an Activation-Keyed Associative Memory'
date: 2026-08-19
permalink: /posts/2026/ak-momentum/
authors:
  - name: Euijin Hong
    url: /
    affiliation: Carnegie Mellon University
  - name: Guannan Qu
    affiliation: Carnegie Mellon University
venue: 'NeurIPS 2026 Main Track (Poster)'
thumbnail: /assets/ak-momentum/figure-a/ak-momentum-figure-a.png
tags:
  - AK-Momentum
  - DeltaMomentum
  - ML Optimizers
  - Associative Memory
---

\[[Paper](https://arxiv.org/abs/2608.19491v2)\] \[[Code](https://github.com/euijinh/ak-momentum)\] \[[BibTeX](#bibtex)\]

> Conventional momentum forgets past gradients uniformly across input directions. **Activation-Keyed Momentum (AK-Momentum)** instead treats momentum as an associative memory of input activations and output-side errors, using the delta rule to selectively refresh stored associations, yielding direction-dependent forgetting and implicit input-side preconditioning.
> 

---

[ Placeholder for headline figure(s): Figure H. and 67M plot of Figure B. ]

---

## The Memory Horizon Gap

---

Conventional momentum maintains an exponentially weighted memory of past gradients:

$$
M_t^{\mathrm{EMA}}
=\beta M_{t-1}^{\mathrm{EMA}}+(1-\beta)g_t.
$$

The coefficient $\beta$ controls how quickly old information fades. Consequently, **every direction in the existing memory decays by the same factor $\beta$.** 

But neural-network activations are mostly not uniformly distributed. Some input directions are encountered frequently, providing repeated opportunities to refresh the stored information. Other directions are encountered less often, requiring longer retention of the memory.

Yet conventional momentum forgets the old information for all directions at the same rate, regardless of how frequently each is observed.

> **Can we leverage the information within the incoming gradient itself to decide which part of momentum's memory to refresh?**
> 

## AK-Momentum: Momentum as Associative Memory

---

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
+\eta\bigl(\delta_t-M_{t-1}\hat{x}_t\bigr)\hat{x}_t^\top
$$

Here, $\hat{x}_t=x_t/|x_t|_2$ is the normalized input activation, and $\eta$ controls the memory correction separately from the model's learning rate.

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

[ Placeholder for Figure A. ]

*Figure A. **Activation-keyed memory update.** The incoming input selects the association to correct: global decay affects the entire memory, while the delta rule additionally removes and rewrites information along the queried direction.*

## **What Is Momentum Actually Learning?**

---

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

## Empirical Results

---

### **Language-Model Pretraining**

We evaluate AK-Momentum by replacing AdamW's first-moment update with the proposed rule, resulting in **AK-AdamW**.

Using Llama-2-style transformers pretrained on FineWeb-Edu, we compare AK-AdamW with AdamW under paired training configurations. Both optimizers share the model initialization, data order, and training schedule, with optimizer hyperparameters tuned at 67M and transferred to larger widths using maximal-update parameterization ($\mu$P).

AK-AdamW consistently reaches matched validation-loss levels in fewer steps:

| Model | Training tokens | Seeds | Mean step reduction |
| --- | --- | --- | --- |
| 67M | 10B | 3 | **39.25%** ± 4.55 pp |
| 370M | 10B | 3 | **17.61%** ± 0.95 pp |
| 1B | 20B | 1 | **13.43%** |

The step reductions are averaged over matched validation-loss levels within the reported measurement window. The uncertainties are standard deviations across seeds, while the 1B experiment serves as a single-seed scale check.

The improvements persist across the evaluated training trajectories, with AK-AdamW also reaching lower final validation loss at all three scales.

[ Placeholder for Figure B. ]

*Figure B. **FineWeb-Edu validation loss versus optimizer steps.** AK-AdamW reaches matched loss levels earlier than AdamW across all three evaluated model sizes. The 67M and 370M curves summarize three seeds; the 1B comparison uses one seed.*

### Efficiency and Computational Overhead

**Fewer optimization steps do not necessarily mean less training time.** AK-Momentum performs additional memory-correction operations, so each training step is more expensive.

In our updated per-step measurements, the additional FLOP costs are approximately **10.00%, 15.54%, and 18.12%** at 67M, 370M, and 1B, respectively. The corresponding measured wall-clock overheads are **15.26%, 17.75%, and 18.44%**.

The practical question is whether improved convergence compensates for this overhead.

In the reported single-seed wall-clock comparisons at 67M and 370M, AK-AdamW initially trails AdamW but eventually crosses over, reaching matched validation-loss levels sooner after the saved steps outweigh their additional cost.

[ Placeholder for Figure C. ]

*Figure C. **Validation loss versus cumulative training time.** AK-AdamW incurs additional computation from the beginning, but its faster convergence eventually offsets this overhead in the reported 67M and 370M comparisons.*

Importantly, AK-Momentum requires **no additional persistent optimizer-state buffers** beyond the base optimizer, although its correction introduces temporary-memory and computational costs.

## **Why It Helps: Theory and Diagnostics**

---

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

[ Placeholder for Figure D. ]

*Figure D. **Mechanistic diagnostics during 67M pretraining.** The buffer–gradient prediction error is lower under AK-AdamW, while the input-feature covariance exhibits less concentration in its leading direction. Both observations are consistent with the proposed mechanism.*

Together, these findings support the memory-based interpretation. They do not, by themselves, isolate the causal contribution of each mechanism to the observed optimization gains.

## **Takeaways and Open Questions**

---

**Momentum need not simply average past gradients.** By exploiting their natural input–error factorization, we can design a memory update that selectively refreshes stored associations according to the inputs encountered during training.

AK-Momentum develops this idea through a delta-rule correction, connecting associative memory, direction-dependent forgetting, and implicit input-side preconditioning within a single optimizer buffer.

Our experiments show encouraging improvements in the evaluated language-model and CIFAR-10 settings, but several questions remain open: whether the gains persist at substantially larger scales and in other training regimes; how AK-Momentum interacts with structured optimizers such as Muon, Shampoo, or SOAP; and whether more efficient fused implementations can further reduce its computational overhead.

More broadly, this work suggests that **the input–error factorized gradient can inform not only how parameters are updated, but also how an optimizer remembers and refreshes information.**


## Paper and citation
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
