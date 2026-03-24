[Skip to main content](https://tegaru.app/en/blog/sm2-algorithm-explained#main-content) [Skip to navigation](https://tegaru.app/en/blog/sm2-algorithm-explained#navigation)

## What is the SM-2 Algorithm?

The SM-2 algorithm, developed by Piotr Wozniak in 1987, is the computational backbone of spaced repetition learning. It's a mathematical formula that determines the optimal time intervals between reviewing flashcards to maximize long-term memory retention while minimizing study time.

The "SM" stands for SuperMemo, the pioneering spaced repetition software where Wozniak first implemented this algorithm. The "2" indicates it was the second iteration, building upon lessons learned from the original SuperMemo algorithm.

### Why SM-2 Matters

Before SM-2, students used arbitrary review schedules or pure cramming. SM-2 introduced a scientific, data-driven approach that schedules reviews right before you're likely to forget, resulting in **200-300% better retention** compared to traditional study methods.

Today, SM-2 powers hundreds of learning applications including Anki, Quizlet, Memrise, and tegaru. Its simplicity, effectiveness, and open-source nature have made it the gold standard for spaced repetition systems.

## How SM-2 Works

The SM-2 algorithm operates on a fundamental principle of cognitive science: **the spacing effect**. Your brain retains information better when you review it at increasing intervals over time, rather than cramming everything at once.

1

### Rate Difficulty

You rate how easy or hard it was to recall the information (0-5 scale)

2

### Calculate Interval

Algorithm calculates optimal days until next review based on your rating

3

### Schedule Review

Card scheduled for review at calculated interval for maximum retention

The beauty of SM-2 is that it adapts to your individual performance. Difficult cards appear more frequently, while easy cards have longer intervals. This personalization makes learning highly efficient.

## Key Components

SM-2 relies on three critical variables that work together to determine review schedules:

### 1\. Quality of Response (Q)

The 6-point scale (0-5) that measures how well you recalled the information:

- **5 - Perfect:** Recalled with perfect ease
- **4 - Correct:** Correct after hesitation
- **3 - Difficult:** Correct with serious difficulty
- **2 - Wrong (remembered):** Incorrect but felt familiar
- **1 - Wrong (familiar):** Incorrect but recognized answer
- **0 - Complete blackout:** No recollection whatsoever

### 2\. Easiness Factor (EF)

A multiplier (starting at 2.5) that represents how "easy" a card is for you:

- Starts at 2.5 for all new cards
- Increases when you rate cards as easy (Q ≥ 4)
- Decreases when you struggle (Q < 3)
- Minimum value: 1.3 (prevents intervals from becoming too short)
- Adapts to your personal difficulty with each card

### 3\. Repetition Number (n)

Tracks how many times you've successfully reviewed the card:

- n = 1: First successful review (interval = 1 day)
- n = 2: Second successful review (interval = 6 days)
- n ≥ 3: Calculated using EF × previous interval
- Resets to 0 if you rate Q < 3 (failed recall)

Pro Tip:

The EF is what makes SM-2 personalized. Two students studying the same card will have different review schedules based on their individual performance history.

## Step-by-Step Calculation

Here's the actual mathematical process SM-2 uses to calculate your next review interval:

**Step 1: Update Easiness Factor (EF)**

EF' = EF + (0.1 - (5 - Q) × (0.08 + (5 - Q) × 0.02))

**Step 2: Ensure EF minimum**

if (EF' < 1.3) then EF' = 1.3

**Step 3: Calculate interval**

if (Q < 3) then n = 0, I = 1 day

else if (n = 1) then I = 1 day

else if (n = 2) then I = 6 days

else I = I(previous) × EF'

### What This Means in Plain English:

1. **First,** the algorithm adjusts your easiness factor based on how you rated the card. Good ratings increase it, poor ratings decrease it.
2. **Second,** it ensures the easiness factor never goes below 1.3 to prevent review intervals from becoming impractically short.
3. **Third,**it calculates when you should see the card next:
   - If you failed (Q < 3): Reset progress, review tomorrow
   - If first success: Review in 1 day
   - If second success: Review in 6 days
   - If third+ success: Multiply previous interval by your easiness factor

This mathematical elegance is why SM-2 has stood the test of time. It's complex enough to be effective, but simple enough to be computationally efficient and easy to understand.

## Practical Example

Let's walk through a real example of studying a flashcard about the Krebs cycle over time:

### Card: "What is the Krebs Cycle?"

Review #1 (Day 0)

You rate: Q = 4 (Correct after slight hesitation)

EF: 2.5 → 2.6 \| n: 0 → 1 \| Next review: 1 day

Review #2 (Day 1)

You rate: Q = 5 (Perfect recall!)

EF: 2.6 → 2.7 \| n: 1 → 2 \| Next review: 6 days

Review #3 (Day 7)

You rate: Q = 4 (Correct after thinking)

EF: 2.7 → 2.8 \| n: 2 → 3 \| Next review: 6 × 2.8 = 17 days

Review #4 (Day 24)

You rate: Q = 3 (Correct but struggled)

EF: 2.8 → 2.68 \| n: 3 → 4 \| Next review: 17 × 2.68 = 46 days

Review #5 (Day 70)

You rate: Q = 2 (Incorrect, but familiar)

EF: 2.68 → 2.18 \| n: 4 → 0 \| Next review: 1 day (RESET!)

Review #6 (Day 71)

You rate: Q = 5 (Nailed it this time)

EF: 2.18 → 2.28 \| n: 0 → 1 \| Next review: 1 day

### Key Observations:

- ✓ Intervals grow exponentially when you perform well
- ✓ Failing resets your progress (but EF retains some "memory")
- ✓ After the reset, you rebuild intervals faster due to adjusted EF
- ✓ The algorithm adapts to your personal difficulty with this specific card

### Experience SM-2 in Action

tegaru uses the proven SM-2 algorithm to optimize your flashcard reviews. Start studying smarter today.

[Try tegaru Free](https://tegaru.app/en/auth/signup)

## Advantages of SM-2

### 1\. Scientifically Proven

Based on decades of research into the spacing effect and forgetting curve. Over 30 years of real-world validation.

### 2\. Time Efficient

Reduces study time by 50-70% compared to traditional methods while maintaining or improving retention.

### 3\. Personalized Learning

Adapts to your individual strengths and weaknesses. No two students have identical review schedules.

### 4\. Simple to Implement

Computationally lightweight and easy to code, making it accessible for developers and apps.

### 5\. Open Source

Free to use and implement, contributing to widespread adoption in educational technology.

### 6\. Long-Term Retention

Optimized for creating permanent memories, not just short-term cramming for exams.

**Bottom line:** SM-2 strikes the perfect balance between effectiveness and simplicity. It's powerful enough to dramatically improve learning outcomes, yet simple enough to run on any device without complex infrastructure.

## Limitations

While SM-2 is highly effective, it's important to understand its limitations:

### Fixed Initial Intervals

The 1-day and 6-day first intervals are hardcoded and don't account for individual differences in initial learning speed.

**Solution:** Modern implementations like SM-15 and FSRS use dynamic initial intervals.

### No Difficulty Prediction

SM-2 doesn't predict difficulty before you've studied a card. All cards start with EF = 2.5.

**Solution:** Some apps analyze card content to preset difficulty estimates.

### Subjective Ratings

The quality rating (0-5) relies on self-assessment, which can be inconsistent or biased.

**Solution:** Simplified rating systems (Easy/Good/Hard/Again) reduce decision fatigue.

### No Card Relationships

Each card is treated independently, ignoring relationships or dependencies between concepts.

**Solution:** Newer algorithms incorporate card clustering and topic relationships.

Despite these limitations, SM-2 remains remarkably effective. For most learners, these drawbacks are minor compared to the massive benefits of using any spaced repetition system versus traditional study methods.

## Modern Implementations

SM-2 has been adapted and modified by various platforms. Here's how popular apps implement it:

### Anki (Modified SM-2)

The world's most popular flashcard app uses a modified SM-2 with enhancements:

- • Simplified 4-button rating system (Again, Hard, Good, Easy)
- • Customizable initial intervals and graduating intervals
- • "Ease Hell" prevention with interval modifiers
- • Optional add-ons for SM-18 and other algorithms

### SuperMemo (SM-18)

The original creator evolved SM-2 into SM-18, which includes:

- • Matrix of optimal intervals based on card history
- • Difficulty prediction for new items
- • Adaptive forgetting index
- • Incremental reading integration

### tegaru (Pure SM-2 + UX)

Implements classic SM-2 with modern user experience:

- • Clean, intuitive interface for rating cards
- • Visual progress tracking and statistics
- • Automatic deck generation from documents
- • Mobile-optimized study sessions

### Quizlet (Proprietary Variant)

Uses SM-2 principles with custom modifications:

- • Machine learning for difficulty prediction
- • Social learning data for interval optimization
- • Game-based study modes
- • Class-level analytics for educators

## Research Behind SM-2

SM-2 isn't just clever programming—it's grounded in decades of cognitive science research:

### Key Research Foundations

Hermann Ebbinghaus (1885)

Discovered the forgetting curve: humans forget 50-80% of new information within days without reinforcement.

Cecil Alec Mace (1932)

Demonstrated that spaced practice leads to better retention than massed practice (cramming).

Arthur Gates (1917)

Found that active recall (testing yourself) is more effective than passive review.

Piotr Wozniak (1987-present)

Developed and refined the SuperMemo algorithms through empirical testing with thousands of students.

### Modern Validation Studies

- **Cepeda et al. (2006):** Meta-analysis of 317 studies confirmed optimal spacing improves retention by 200%+
- **Karpicke & Roediger (2008):** Spaced retrieval practice produced 250% better long-term retention
- **Kornell & Bjork (2008):** Spacing effect works across all age groups and subject matters
- **Dunlosky et al. (2013):** Rated spaced practice and practice testing as the #1 and #2 most effective study techniques

The consensus is clear: spaced repetition works. SM-2's genius was translating these research findings into a practical, implementable algorithm that anyone could use.

### Ready to Use SM-2 for Your Studies?

Join thousands of students using scientifically-proven spaced repetition to ace their exams.

[Explore Features](https://tegaru.app/en/features)

## Getting Started with SM-2

Ready to harness the power of SM-2? Here's how to start:

1

### Choose Your Platform

Select an app that uses SM-2:

- • **tegaru:** Best for AI-generated decks from documents
- • **Anki:** Best for manual card creation and customization
- • **Quizlet:** Best for collaborative learning

2

### Create Quality Cards

Follow the minimum information principle:

- • One concept per card
- • Clear, concise questions
- • Specific, unambiguous answers
- • Add context when necessary

3

### Study Daily

Consistency is critical for SM-2 to work:

- • Review cards every day (even weekends)
- • Do all cards due each day
- • 15-30 minutes daily beats 3-hour weekly sessions
- • Trust the algorithm's scheduling

4

### Rate Honestly

Your ratings train the algorithm:

- • Be truthful about difficulty
- • Don't rate "Easy" just to get it over with
- • If you hesitated, it's not a 5
- • Failed recall? Mark it wrong and learn from it

5

### Track Your Progress

Monitor your learning analytics:

- • Retention rate (aim for 85-95%)
- • Daily review count
- • Study streaks
- • Average easiness factors

### Success Timeline

- **Week 1:** Getting used to daily reviews, building initial deck
- **Week 2-4:** Review sessions stabilize, intervals start expanding
- **Month 2-3:** Noticeable retention improvements, confidence builds
- **Month 6+:** Long-term memory consolidation, dramatic time savings

## Related Articles

[**Spaced Repetition vs Cramming** \\
See the data on why spacing beats cramming every time](https://tegaru.app/en/blog/spaced-repetition-vs-cramming) [**Best Spaced Repetition Apps** \\
Complete comparison of SM-2 powered apps in 2025](https://tegaru.app/en/blog/best-spaced-repetition-apps-compared) [**Spaced Repetition Research** \\
Deep dive into 20+ studies validating the technique](https://tegaru.app/en/blog/spaced-repetition-research-studies)

## Start Using SM-2 Today

Transform your study materials into optimized flashcard decks with tegaru's AI-powered platform. The SM-2 algorithm does the heavy lifting—you just study smarter.

[Get Started Free](https://tegaru.app/en/auth/signup) [See How It Works](https://tegaru.app/en/how-it-works)

SM-2 Algorithm Explained: The Science Behind Spaced Repetition \| Tegaru Blog

### We Use Cookies

We use essential cookies for Google OAuth authentication, functional cookies to remember your study preferences (flashcard settings, language), and analytics cookies to understand how our hundreds of users navigate the platform. This helps us improve Tegaru's features.

Accept AllDecline

Learn more in our privacy policy page.