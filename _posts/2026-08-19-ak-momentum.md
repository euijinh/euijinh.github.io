---
title: 'AK-Momentum'
date: 2026-08-19
permalink: /posts/2026/08/ak-momentum/
tags:
  - AK-Momentum
  - DeltaMomentum
  - ML Optimizers
  - Associative Memory
---

## On why we devised it, how it works, and why we should use it

***Activation-Keyed Momentum: An anisotropic momentum update via the delta rule***

**Euijin Hong and Guannan Qu**  
Electrical and Computer Engineering, Carnegie Mellon University  
arXiv preprint · [Paper](https://arxiv.org/abs/2608.19491v2) · [PDF](https://arxiv.org/pdf/2608.19491v2) · [Code](https://github.com/euijinh/ak-momentum)

Modern optimizers from AdamW to Muon use momentum as their updates. There are many existing ways to interpret the role of momentum, and one intuitive way is to view momentum as a "memory" of previous gradients, and the optimizer leverages it to dampen oscillations and speed up the iterations, leading to faster convergence. Standard momentum, also known as Exponential Moving Average (EMA) momentum, lets that memory fade at the same rate in every input direction. 

However, this momentum update rule alone does not fully mitigate the "anisotropy" of the input activations (i.e. the imbalance of eigenvalues within the input spectrum) during neural network training. Such anisotropy is mainly caused by the non-uniform distribution of the input data and intermediate activations as the network learns as training progresses, and the standard EMA momentum update rule does not take this into account for weight updates. 

Preconditioning-based optimizers such as K-FAC, Shampoo, and SOAP apply additional statistical information on top of this momentum to guide and recalibrate the update to mitigate the anisotropy and achieve better convergence, leaving the EMA update rule identical even though this is the main source of tension. Although these methods are theoretically sound and practically effective (especailly on per-step training), they often require heavy computation and additional memory to store and compute the additional statistical information. 

So, the existing problem is clear: *we want a method to update the weights based on the momentum buffer reflecting the anisotropy of the input activations, but without the heavy computation and additional memory required by heavy preconditioners*.

Here, a simple yet powerful idea comes into play: why not leverage the natural and free decomposition of the gradient as an outer product of the output-side error and the input activation, and utilize the input activation to perform a direction-selective forgetting within the momentum buffer? This is exactly how the delta rule works in associative memories: to selectively forget and update the memory based on the historical accounting of the *keys*. Correspondingly, the input activation becomes the *key* in the delta rule, and the output-side error becomes the *value* associated with it. The momentum buffer is therefore "*activation-keyed*", and the resulting momentum update is a single-step online delta-rule based update in this key-value formulation.

That is the whole motivation and idea behind Activation-Keyed Momentum (AK-Momentum). AK-Momentum makes the update depend on the input directions a layer actually sees, using those inputs to decide which stored information to refresh. Consequently, **AK-Momentum offers a preconditioner-like update directly to the momentum buffer, without heavy computation and additional memory required by explicitly formed preconditioners**.

The proposed update rule operates inside the momentum buffer. In FineWeb-Edu pretraining, **AK-AdamW reaches AdamW's validation loss in up to $46.39\pm4.32$ fewer steps at 67M and $22.12\pm0.80$ fewer at 370M**, over three seeds. A single-seed 1B run provides a further scale check. Below, we explain the mechanism, what the theory establishes, and when the saved steps outweigh the additional work per step.

## Why change what momentum remembers?

For a gradient $g_t$, an exponential moving average, or EMA, updates its buffer as

$$
M_t^{\mathrm{EMA}}=\beta M_{t-1}^{\mathrm{EMA}}+(1-\beta)g_t.
$$

The coefficient $\beta$ controls how much previous information survives. Every direction receives the same decay, even when the layer's inputs are distributed very unevenly across directions. We call this unevenness **anisotropy**.

Frequently encountered directions can provide repeated opportunities to refresh outdated information. Rarely encountered directions receive fewer such opportunities. Our starting question is whether the momentum update can use this difference directly.

## A memory for input directions

Consider one linear layer, $y=Wx$. For one example, its weight gradient factorizes as $g=\delta x^\top$, where $x$ is the input activation and $\delta=\partial\mathcal L/\partial y$ is the backpropagated error at the output.

This gives the gradient a natural association: **the input is a key, and the output-side error is the value associated with it**. A matrix-shaped momentum buffer can store these associations. Given an input, multiplying the buffer by that input retrieves a prediction of the corresponding error.

AK-Momentum updates this memory through the classical delta rule. In the normalized-key form used in our experiments, $\hat x_t=x_t/\lVert x_t\rVert_2$ and

$$
\boxed{M_t=\beta M_{t-1}+\eta\bigl(\delta_t-M_{t-1}\hat x_t\bigr)\hat x_t^\top.}
$$

Here, $\eta$ controls the correction to the buffer; it is separate from the learning rate that updates the model's weights. The rule has three operations:

1. **Read.** Retrieve the stored prediction $M_{t-1}\hat x_t$ for the current input.
2. **Compare.** Compute the difference between the observed error $\delta_t$ and that prediction.
3. **Correct.** Write the difference back along the current input direction, while retaining the overall decay $\beta$.

To see what changes, imagine two perpendicular input directions, $u$ and $v$. The current normalized input is $u$. The update gives $M_tu=(\beta-\eta)M_{t-1}u+\eta\delta_t$, while $M_tv=\beta M_{t-1}v$.


| Old information being carried forward | EMA                   | AK-Momentum                |
| ------------------------------------- | --------------------- | -------------------------- |
| Along the queried direction $u$       | Multiplied by $\beta$ | Multiplied by $\beta-\eta$ |
| Along the perpendicular direction $v$ | Multiplied by $\beta$ | Multiplied by $\beta$      |


The additional correction acts where the new input points. If $u$ is queried repeatedly, its old information is repeatedly attenuated and refreshed. Information along $v$ still undergoes ordinary EMA decay. For this illustration, take $0<\eta\leq\beta<1$, so both retention factors are nonnegative.

*Figure A. Refreshing a stored association. An input along $u$ produces an additional correction along $u$, while information along the perpendicular direction $v$ retains the ordinary decay $\beta$. The illustration separates the contribution of old memory from the newly written value.*

Normalizing the key prevents its magnitude from arbitrarily amplifying the forgetting term. The model's forward computation still uses its ordinary activations. The experiments apply the update in batches, as detailed later. [Paper, Sections 2–3 and Appendix L](https://arxiv.org/pdf/2608.19491v2#page=3)

## Fewer steps to the same validation loss

Our main comparison replaces AdamW's first-moment update with AK-Momentum, producing **AK-AdamW**. Its second-moment calculation, bias-correction procedure, and decoupled weight decay follow AdamW.

We pretrain Llama-2-style, 24-layer decoder-only transformers on FineWeb-Edu, with 2,048-token sequences and 524,288 training tokens per optimizer step. Paired AdamW and AK-AdamW runs share initialization, data order, architecture, and training schedule. Optimizer settings are tuned separately at 67M and transferred to larger widths using maximal-update parameterization, or $\mu$P.

AK-AdamW reaches matched validation-loss levels in fewer steps and finishes at a lower validation loss at all three scales we evaluate.


| Model | Training tokens | Seeds | Mean step reduction | Maximum step reduction |
| ----- | --------------- | ----- | ------------------- | ---------------------- |
| 67M   | 10B             | 3     | $39.25\pm4.55$      | $46.39\pm4.32$         |
| 370M  | 10B             | 3     | $17.61\pm0.95$      | $22.12\pm0.80$         |
| 1B    | 20B             | 1     | $13.43$             | $19.37$                |


These are reductions in steps to reach the **same validation loss**, measured across matched loss levels in the window beginning at step 2,000. “Mean” averages across those levels; “maximum” selects the largest saving. The $\pm$ values report seed standard deviations. The 1B run is a scale check with one seed.

*Figure B. Validation loss during FineWeb-Edu pretraining. Lower is better. Curves at 67M and 370M are means over three seeds, with bands showing variation across runs; the 1B comparison uses one seed. The plotted range omits the early high-loss region to make the subsequent separation readable.*

We also compare against Muon at 67M and 370M. AK-AdamW's validation-loss curves remain below that tuned baseline in the reported runs. All three optimizers use the same Optuna search procedure with comparable budget per tuned dimension, although total search compute differs. This comparison describes the configurations and training protocol we tested. [Paper, Section 4.1 and Appendices N, O, and T](https://arxiv.org/pdf/2608.19491v2#page=10)

## From fewer steps to less training time

Each AK-AdamW step requires additional computation. The practical question is whether the saved steps compensate for this cost.


| Model | Additional FLOPs per step | Measured step time relative to AdamW | Mean FLOPs saved at matched loss | Mean wall-clock time saved at matched loss |
| ----- | ------------------------- | ------------------------------------ | -------------------------------- | ------------------------------------------ |
| 67M   | $11.2$                    | $1.177\times$                        | $25.9$                           | $21.6$                                     |
| 370M  | $17.4$                    | $1.153\times$                        | $4.5$                            | $6.2$                                      |


The savings columns average over matched loss levels **after the cost curves cross**. Early in training, the extra work has not yet paid for itself. These cost comparisons use single-seed trajectories and timing on a single H200 with our non-fused implementation; they do not have the three-seed uncertainty estimates of the step-saving table.

*Figure C. Validation loss against cumulative elapsed training time on a single H200. The additional cost is paid from the first step. AK-AdamW gains a time advantage after the curves cross, and remains ahead over the subsequent measured range. Each curve represents one run.*

AK-Momentum adds no persistent optimizer-state buffers beyond those of the base optimizer. It does require temporary activation-related storage and additional computation. [Paper, Table 3 and Appendix M](https://arxiv.org/pdf/2608.19491v2#page=11)

## What the analysis establishes

**Memory becomes direction-dependent.** Under the paper's independent, stationary-key assumptions, old information along an eigenvector of the normalized input second moment has expected retention factor $\beta-\eta\hat\lambda_i$. Here, $\hat\lambda_i=\mathbb E[(u_i^\top\hat x)^2]$ measures how strongly normalized inputs occupy that direction. With nonnegative retention factors, larger values mean faster forgetting; directions with values near zero retain an EMA-like memory horizon. This is the general version of the two-direction example. [Lemma 3.7](https://arxiv.org/pdf/2608.19491v2#page=7)

**The buffer learns a regularized predictor.** When the relevant statistics can be treated as fixed and the recursion is stable, the expected buffer approaches a linear predictor of output-side errors from input keys, with a penalty on large buffer weights. Its fixed point applies an input-side correction without explicitly inverting a matrix during each update. This describes a different target from EMA's mean raw gradient. [Theorem 3.4 and Corollary 3.5](https://arxiv.org/pdf/2608.19491v2#page=6)

Mathematical detail: the normalized-key fixed point

Write $\hat\Sigma=\mathbb E[\hat x\hat x^\top]$ and $\hat G=\mathbb E[\delta\hat x^\top]$. Under the fixed-statistics approximation and stability condition in the paper,

$$
M^*=\hat G(\mu I+\hat\Sigma)^{-1},\qquad \mu=\frac{1-\beta}{\eta}.
$$

Along an eigenvector $u_i$ of $\hat\Sigma$, this gives $M^*u_i=\hat G u_i/(\mu+\hat\lambda_i)$. The inverse appears in the characterization of the limiting buffer; the implemented recurrence uses matrix products.

The relationship to K-FAC concerns an input-side factor. Full K-FAC also includes an output-side factor, and the deployed rule uses normalized input statistics. Identifying its target with a correction of the raw mean gradient requires the additional magnitude assumptions in Corollary 3.5.

**Tracking can improve when the target changes.** The analysis characterizes adaptation after shifts to new statistics and bounds lag under specified drift assumptions. In the analyzed parameter dynamics, it also establishes faster per-direction convergence in the stated oscillatory, or underdamped, regime. That comparison is conditional: the smaller determinant proved in the paper does not by itself guarantee faster convergence at every fixed learning rate. The tracking results also do not establish a global convergence rate for arbitrary nonconvex training. [Sections 3.3–3.4](https://arxiv.org/pdf/2608.19491v2#page=8)

## Measuring the proposed mechanism

Learning curves establish an optimization benefit. To examine the proposed explanation, we also probe the 67M run during training.

One measurement is the relative difference between the buffer and the current gradient, $\lVert M_t-g_t\rVert_F/\lVert g_t\rVert_F$. AK-AdamW has lower error at the logged checkpoints. Another measures how much input-feature variance is concentrated in the leading direction. This concentration is lower under AK-AdamW in the reported comparison.

*Figure D. Two diagnostics from the 67M run. Left: relative momentum–gradient prediction error, where lower means closer agreement with the current gradient. Right: the fraction of input-feature variance in the leading direction, taking the maximum across layers; lower means less concentration in that statistic. Both measurements move in the direction suggested by the proposed mechanism.*

The paper also reports momentum–gradient alignment, output-error prediction alignment, feature condition numbers, and effective rank. Together, these observations support the theoretical picture. They do not independently isolate every causal contribution to the loss improvement. [Paper, Section 4.2](https://arxiv.org/pdf/2608.19491v2#page=11)

## Using AK-Momentum

Applying the method requires access to each supported layer's inputs and output-side errors, in addition to its weight gradient. Our implementation collects these signals through forward and backward hooks. In the language-model experiments, embeddings and the output head use standard AdamW with an auxiliary learning rate.

For the settings studied in the paper, our recommended starting recipe is:

- Use normalized keys, $\beta=0.99$, and $\eta=0.4$.
- Keep AdamW's second-moment and weight-decay settings as the starting point.
- Start the main learning rate near one tenth of the tuned AdamW rate, then tune it for the new buffer.
- Treat the embedding/output-head learning rate separately; our selected configurations use an independently tuned auxiliary rate.

This is a starting recipe from the reported experiments. The headline AK-AdamW configuration used $\eta=0.37$, selected by Optuna. A separate single-seed sensitivity study found a broad basin over $\eta\in[0.10,0.99]$, with final validation loss varying by at most 0.015 nats in that study.

Under the paper's $\mu$P setup, $\eta$ and $\beta$ transfer across widths without rescaling, while the learning rate follows the base optimizer's width rule. The 370M and 1B runs inherit settings tuned at the 67M proxy. [Paper, Appendices N and Q–U](https://arxiv.org/pdf/2608.19491v2#page=32)

Implementation detail: the batch update

For $N$ examples or tokens, let $\hat X$ contain row-normalized input keys and $\Delta$ contain output-side errors. The deployed batch rule is

$$
G_t=\frac{\Delta^\top\hat X}{N},\qquad
\hat\Sigma_t=\frac{\hat X^\top\hat X}{N},\qquad
M_t=\beta M_{t-1}+\eta(G_t-M_{t-1}\hat\Sigma_t).
$$

$G_t$ uses normalized keys. AdamW's second moment continues to use the ordinary weight gradient. The correction can be evaluated through either $M(\hat X^\top\hat X)$ or $(M\hat X^\top)\hat X$, including the batch normalization factor, with contraction order chosen by layer shape. The latter avoids forming the full input Gram matrix. [Appendices L–M](https://arxiv.org/pdf/2608.19491v2#page=26)

## Connections and current scope

The delta rule and the associative-memory view of optimizers build on earlier work. Our contribution develops an activation-keyed update for the momentum buffer and studies its memory dynamics, scaling, and empirical behavior. [Paper, Appendix B](https://arxiv.org/pdf/2608.19491v2#page=16)


| Approach                 | Mechanism relevant to this comparison                               |
| ------------------------ | ------------------------------------------------------------------- |
| EMA momentum             | Scalar decay and averaging of previous gradients                    |
| AK-Momentum              | Activation-keyed correction within the momentum buffer              |
| Muon                     | Approximate orthogonalization of a momentum-derived matrix update   |
| K-FAC, Shampoo, and SOAP | Structured preconditioning using additional statistical information |


Our experiments evaluate AK-AdamW and AK-SGD. CIFAR-10 experiments provide supporting checks across an MLP, ResNet-18, and ViT-Tiny; the ResNet and ViT summary reports training-loss improvements. Combining AK-Momentum with Muon, Shampoo, or SOAP remains future work, and we do not report Shampoo or SOAP baselines.

The main evidence covers language-model pretraining up to 1B parameters. Larger models, image generation, reinforcement learning, mixed-modality training, and a controlled comparison against a gradient-keyed delta-rule buffer remain open. The normalized-key rule also has real computational and temporary-memory costs, and the reported timing uses a non-fused implementation. [Paper, Sections 4.3–5 and Appendix O](https://arxiv.org/pdf/2608.19491v2#page=12)

## Paper and citation

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