In this piece, I want to connect YouTube Shorts and TikTok to [spaced repetition](https://gwern.net/spaced-repetition) and [incremental reading](https://www.youtube.com/watch?v=oNCLLNZEtz0) which I've worked on for the past 4 years.

If you think about it, all of these systems fall into the general bucket of "recommender systems" - systems which attempt to predict and provide content that is most relevant to the user based on their past interactions.

I made the connection while working at [RemNote](https://remnote.com/) and thinking about ways to make the spaced repetition review experience more enjoyable - why do people kick back and relax at the end of a long day by watching four hours of YouTube shorts, but find 10-minute Anki review sessions to be a miserable chore? Is the only way to make flashcard queues more engaging to make the content more sensationalist and "trashy" similar to YouTube shorts and TikTok, or can you become addicted to educational content that helps you improve your life and make progress towards your goals?

I want to explore the potential for a system that borrows the best elements from each to create something that feels as effortless and engaging as a queue of YouTube shorts but actually helps you make progress towards meaningful goals.

## A Recommendation System for Your Memory

Spaced repetition systems (SRSs) are digital flashcard managers like [Anki](https://apps.ankiweb.net/), [SuperMemo](https://supermemo.store/products/supermemo-19-for-windows) and [RemNote](https://remnote.com/). You can think of them as **recommender systems for your memory** which direct your attention towards information you are about to forget.

While they are [extremely effective](https://gwern.net/spaced-repetition) at combatting forgetting, many users struggle to maintain consistent review habits because the system prioritises showing you information that you are about to forget over information that you would find interesting.

### How Spaced Repetition Works

Spaced repetition systems use algorithms which calculate the optimal review times and fewest repetitions required to keep flashcards in your memory. The intervals between reviews expand with each repetition allowing you to maintain your knowledge with exponentially lower effort over time.

By controlling the rate of forgetting, you eliminate the churn effect in learning. Without spaced repetition, your knowledge grows asymptotically towards a saturation level as the rate of forgetting old knowledge balances the rate of learning new knowledge.

![no srs](https://res.cloudinary.com/practicaldev/image/fetch/s--fzDjQySI--/c_limit%2Cf_auto%2Cfl_progressive%2Cq_auto%2Cw_800/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/l7w55pxu9rkbahr0qvfk.png)

Spaced repetition **linearises the acquisition of knowledge**. By calculating optimal review dates and exponentially increasing review intervals, a single flashcard may be repeated as little as 6-20 times across your entire lifetime, meaning that you may be able to remember as many as [250-300 thousand flashcards by the time you retire](https://supermemo.guru/wiki/How_much_knowledge_can_human_brain_hold).

![with srs](https://res.cloudinary.com/practicaldev/image/fetch/s--fu3_bhrK--/c_limit%2Cf_auto%2Cfl_progressive%2Cq_auto%2Cw_800/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/t188pm8p2kdg17d0kwtc.png)

### Why Hasn't Spaced Repetition Taken Over the World

Spaced repetition has proved itself to be an effective learning technique across a [wide range of disciplines](https://www.reddit.com/r/Anki/comments/ubbdoc/anki_success_stories/), from [language learning](https://www.youtube.com/watch?v=l3nd0cF-SOA) to [medical school](https://www.reddit.com/r/medicalschoolanki/comments/hnkg7z/260_with_lightyear_deck/), [mathematics](https://www.youtube.com/watch?v=_RdjsVngZz8) and [coding](https://www.reddit.com/r/programming/comments/n30hl/janki_method_learning_programming_with_6000/).

I used Anki to learn Chinese to the point where I can comfortably read science fiction like [The Three Body Problem](https://en.wikipedia.org/wiki/The_Three-Body_Problem_(novel)) without a dictionary. I used SuperMemo to learn coding from scratch with no technical background which then became my full-time job. And I used RemNote to learn math, later writing [an intro to logic and proof course using an interactive theorem prover and RemNote](https://x.com/experilearning/status/1694642965140934913?s=20) as someone who hadn't studied math since I was 16.

Spaced repetition can change your life and [it has the potential to change the world](https://scalingknowledge.substack.com/p/spaced-repetition-for-knowledge-creation), but it's rare to see it used outside of cramming for exams (language learning being the major exception). Students endure the spaced repetition algorithm until they graduate and feel a great sense of relief when they can finally delete their flashcard decks for good. Burnout is also common with many users feeling crushed by their daily repetitions.

#### Misaligned Objective Function

The objective function of the spaced repetition algorithm is to maximise the user's memory retention with the fewest number of repetitions. I've argued before that this is often out of line with users' real-world goals and makes it hard to enjoy the review experience.

Twitter Embed

[Visit this post on X](https://twitter.com/experilearning/status/1476655088999538699?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E1476655088999538699%7Ctwgr%5E%7Ctwcon%5Es1_&ref_url=)

[Jamesb](https://twitter.com/experilearning?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E1476655088999538699%7Ctwgr%5E%7Ctwcon%5Es1_&ref_url=)

[@experilearning](https://twitter.com/experilearning?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E1476655088999538699%7Ctwgr%5E%7Ctwcon%5Es1_&ref_url=)

·

[Follow](https://twitter.com/intent/follow?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E1476655088999538699%7Ctwgr%5E%7Ctwcon%5Es1_&ref_url=&screen_name=experilearning)

[View on X](https://twitter.com/experilearning/status/1476655088999538699?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E1476655088999538699%7Ctwgr%5E%7Ctwcon%5Es1_&ref_url=)

1/n Not just fields, also goals. Current SRS algos direct your attention towards info. you are about to forget. This is optimal if your goal is max memorization efficiency, but I think it often doesn't perfectly align with users' actual real world goals.

[Visit this post on X](https://twitter.com/giacomo_ran/status/1476513935566290944?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E1476655088999538699%7Ctwgr%5E%7Ctwcon%5Es3_&ref_url=)

giacomo

@giacomo\_ran

Spaced repetition more or less works independently on the domain of study.

I wonder if the optimal scheduler looks different for different fields.

[8:43 PM · Dec 30, 2021](https://twitter.com/experilearning/status/1476655088999538699?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E1476655088999538699%7Ctwgr%5E%7Ctwcon%5Es1_&ref_url=)

[X Ads info and privacy](https://help.twitter.com/en/twitter-for-websites-ads-info-and-privacy)

[19](https://twitter.com/intent/like?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E1476655088999538699%7Ctwgr%5E%7Ctwcon%5Es1_&ref_url=&tweet_id=1476655088999538699) [Reply](https://twitter.com/intent/tweet?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E1476655088999538699%7Ctwgr%5E%7Ctwcon%5Es1_&ref_url=&in_reply_to=1476655088999538699)

Copy link

[Read 1 reply](https://twitter.com/experilearning/status/1476655088999538699?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E1476655088999538699%7Ctwgr%5E%7Ctwcon%5Es1_&ref_url=)

Because the goal is to maximise memory retention, **the bulk of your reviews will be focused on the flashcards that are most difficult for you**. From the perspective of the spaced repetition algorithm, it would be considered a waste of time to review flashcards that you easily remember because if you can easily remember them, the system can confidently boost the review interval far into the future, satisfying its goal of minimising your repetition load. Instead, it's considered better to show you the cards you find most difficult more often so you can burn them into your memory.

As a result, reviewing your flashcard queue becomes a punishing experience where you are predominantly reviewing information you don't understand very well. Avoiding this requires quite a lot of attention and care, obsessing over [flashcard formulation](https://controlaltbackspace.org/precise/), eliminating [leeches](https://docs.ankiweb.net/leeches.html) and aiming for a consistent [90% retention rate](https://supermemo.guru/wiki/Forgetting_index_in_SuperMemo#:~:text=If%20the%20forgetting%20index%20is%20too%20high%2C%20your%20repetitions%20will%20be%20stressful%20due%20to%20constant%20problems%20with%20recall.).

![Image description](https://res.cloudinary.com/practicaldev/image/fetch/s--Eg-__4KO--/c_limit%2Cf_auto%2Cfl_progressive%2Cq_66%2Cw_800/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/2xunzmk5a0fnknm909pp.gif)

Here's another way to think about it: in a pure spaced repetition system **flashcards outcompete other flashcards for your attention by being more difficult to remember**. Wouldn't we be happier if our flashcards competed for our attention by being _more interesting_ as opposed to more difficult? I realised that this is effectively how recommender systems like YouTube and TikTok work - they are markets of video clips competing to be as interesting and engaging as possible for users. This thought is what got me interested in studying them more closely.

## Incremental Reading

[Incremental reading](https://www.youtube.com/watch?v=oNCLLNZEtz0) systems like [SuperMemo](https://supermemo.guru/wiki/Incremental_reading) are a superset of spaced repetition systems. Incremental reading involves interleaving your flashcards with snippets from articles, books and videos in a big prioritised queue.

> The general idea is to form a "funnel of knowledge" in which a vast worldwide web is converted into a "selection of own material", that moves to important highlights (extracts), that get converted to active knowledge (cloze deletion), which is then made stable in memory, and, in the last step, acted upon in a creative manner in problem solving. - [Incremental Reading](https://supermemo.guru/wiki/Incremental_reading#:~:text=The%20general%20idea,problem%20solving.)

What is Incremental Reading? - YouTube

Tap to unmute

[What is Incremental Reading?](https://www.youtube.com/watch?v=oNCLLNZEtz0) [Experimental Learning](https://www.youtube.com/channel/UCIaS9XDdQkvIjASBfgim1Uw)

Experimental Learning2.43K subscribers

[Watch on](https://www.youtube.com/watch?v=oNCLLNZEtz0)

It's interesting to analyse them through the lens of recommender systems and compare them to pure spaced repetition systems like Anki because **incremental reading systems do a much better job at allowing the user to enjoy the review process**.

Between 2020 and 2022 I spent a lot of time using SuperMemo, read all of [Piotr Wozniak's articles](https://supermemo.guru/), talked to hundreds of people in the [SuperMemo.Wiki Discord channel](https://discord.com/invite/vUQhqCT) and started a [YouTube channel](https://www.youtube.com/channel/UCIaS9XDdQkvIjASBfgim1Uw) and [podcast](https://www.youtube.com/channel/UC9PA26yTZOsJB_wHJXN6sKg) related to these ideas.

I met [ex-gamers who went from spending 8 hours per day playing League of Legends](https://www.youtube.com/watch?v=0VvSj2hHGk4) to live-streaming themselves reviewing their incremental reading queue for 8 hours per day.

![quit gaming for srs](https://res.cloudinary.com/practicaldev/image/fetch/s--z6ZACFHG--/c_limit%2Cf_auto%2Cfl_progressive%2Cq_auto%2Cw_800/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/kds6bvp2negdo5y7opat.png)

![learning addiction](https://res.cloudinary.com/practicaldev/image/fetch/s--ksdzQxAP--/c_limit%2Cf_auto%2Cfl_progressive%2Cq_auto%2Cw_800/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/dbox4460h7kzle0t6hto.png)

Many people were not in school (myself included) or had never been to school at all! We didn't have exams to study for. But instead of playing video games, we spent all day using this obscure learning software with a UI like a NASA rocket dashboard.

![Image description](https://res.cloudinary.com/practicaldev/image/fetch/s--y_EY3Nji--/c_limit%2Cf_auto%2Cfl_progressive%2Cq_auto%2Cw_800/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/xhhn6auzvgshny50od2q.png)

Instead of watching Netflix, we had month-long debates over [whether flashcards ought to be formulated using analogies](https://www.youtube.com/watch?v=Aul2gX0j5Oo)

and [made guides about how you should prioritise and value learning material](https://www.youtube.com/watch?v=OwV5HPKMrbg). Why?

The only way to explain it is by breaking down the concept of knowledge valuation.

### A Nose for the Interesting

Why Lectures Don't Work: Learntropy - YouTube

[Photo image of Experimental Learning](https://www.youtube.com/channel/UCIaS9XDdQkvIjASBfgim1Uw?embeds_referring_euri=https%3A%2F%2Fdev.to%2F)

Experimental Learning

2.43K subscribers

[Why Lectures Don't Work: Learntropy](https://www.youtube.com/watch?v=pLFwsGL0sX0)

Experimental Learning

Search

Watch later

Share

Copy link

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

More videos

## More videos

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

[Watch on](https://www.youtube.com/watch?v=pLFwsGL0sX0&embeds_referring_euri=https%3A%2F%2Fdev.to%2F)

0:00

0:00 / 11:18

•Live

•

Humans are naturally attracted to information that is surprising, novel, consistent and coherent. Sometimes we are attracted to contradictory information - I think it depends on your personality type. But for the most part, we love information that "slots in" or that we can relate in some way to our prior knowledge and our current goals. **[Understanding is pleasurable](https://www.youtube.com/watch?v=eAnNGqwI2AQ)**. We don't like information that we can't relate in some way to our prior knowledge. When we are forced to try to understand something when we don't know the pre-requisite concepts, we get bored and frustrated and start yawning.

#### Semantic Distance

![semantic distance](https://res.cloudinary.com/practicaldev/image/fetch/s--q0ukKiIu--/c_limit%2Cf_auto%2Cfl_progressive%2Cq_auto%2Cw_800/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/k901eipw5b0jni67j1l6.png)

Semantic distance is like the "knowledge gap" between what you already know and some new information input. For example, there's a semantic distance between your current knowledge of mathematics and a new mathematical subject you haven't studied before. When the gap is too large, it makes it impossible to understand the new information because you can't relate it meaningfully to what you already know. If you take a graduate-level math lecture before having studied math 101, it will be impossible, you will display physical signs of displeasure, like fidgeting, restlessness, yawning and more - your body is telling you to go do something else!

![Image description](https://res.cloudinary.com/practicaldev/image/fetch/s--T8pvYmSc--/c_limit%2Cf_auto%2Cfl_progressive%2Cq_auto%2Cw_800/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/gjz226xzc6ea2328w6v7.png)

Anyone who has used spaced repetition systems at school understands the feeling of needing to drill flashcards into your brain that just won't stick and it's a horrible feeling.

There are two main features in incremental reading systems which avoid this making them much more enjoyable to use - prioritisation and variable reward.

#### The Priority Queue

![Image description](https://res.cloudinary.com/practicaldev/image/fetch/s--cGOeTjvF--/c_limit%2Cf_auto%2Cfl_progressive%2Cq_auto%2Cw_800/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/nat62spnwb36fc2s4j4h.png)

Incremental reading systems add prioritisation to the queue, so unlike a pure spaced repetition system, you aren't shown information based only on how likely you are to forget it. You can use the priority system to attach a subjective sense of importance or "interestingness" to each item in the queue. The priority is just a number from 0-100, what exactly it means is up to the user to determine and will likely vary over time as their values and goals evolve.

You are also encouraged to break up large pieces of content into smaller chunks and apply more granular prioritisation mechanisms. This is very similar to the way people chop up clips from long podcasts and upload the highlights to YouTube shorts or TikTok.

This is an improvement over pure spaced repetition because **flashcards no longer compete for your attention based on how difficult they are, but also based on how interesting you find them**. Since [understanding is pleasurable](https://www.youtube.com/watch?v=eAnNGqwI2AQ), people naturally assign the highest priorities to material that is novel but comprehensible. Any material that is too complex gets sent to the back of the queue. By the time you reach it, you may have built up the pre-requisite concepts for it to become interesting to you.

This works well as long as you are diligent about updating priorities for each flashcard or article in your collection to maintain the mapping between how interesting your brain finds them and their order in the priority queue. But what inevitably happens is that you take a break from the system, your interests change and the priorities you assigned 6 months ago are now out of sync with your current interests. Users end up complaining about "stale collections" of material they used to find interesting, but which they no longer care about.

![Image description](https://res.cloudinary.com/practicaldev/image/fetch/s--8MP66Wtz--/c_limit%2Cf_auto%2Cfl_progressive%2Cq_auto%2Cw_800/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/per3vkt82x5a23am6s4r.png)

It would be better if the system could quickly and dynamically adjust what it recommends to you by inferring your interests from your current behaviour, similar to modern recommender algorithms.

### Variable Reward

![variable reward in IR](https://res.cloudinary.com/practicaldev/image/fetch/s--kWNoQEkV--/c_limit%2Cf_auto%2Cfl_progressive%2Cq_auto%2Cw_800/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/36oy31nfi97i99hnjvp2.png)

Just having a mixture of different information types in your queue makes it much more enjoyable. It can be draining to read or answer flashcards for hours on end, why not break it up with some more passive sources like YouTube videos?

Incremental reading systems differ from recommender systems in that you are responsible for adding all the material manually into your queue. But as the intervals between repetitions and the amount of items in your collection grows, you tend to forget what you put in your queue, so you can't predict what's coming next. All you know is that whatever comes next is something that you believed was important enough to import and assign a priority. This makes going through your queue surprising. Articles and videos interleaved together with flashcards force seemingly unrelated concepts into your attention in quick succession, often resulting in unexpected connections.

![Image description](https://res.cloudinary.com/practicaldev/image/fetch/s--fbW-lZCu--/c_limit%2Cf_auto%2Cfl_progressive%2Cq_auto%2Cw_800/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/fflh8vw7lalm20ql534q.png)

But current incremental reading systems aren't set up to give you completely unexpected content - they rely on you manually going out to search for things. Nor is there any notion of collaborative filtering - incremental reading systems are single-player games. And due to information overload and the degradation in the quality of the search results from Google search, this is becoming more and more frustrating.

## YouTube Shorts

Now let's examine YouTube shorts. Why is it that people are able to kick back and relax at the end of a long day by watching four hours of YouTube shorts, but would despise spending four hours doing flashcard repetitions in Anki?

Why do people willingly forego meals and sleep to watch TikTok but only do Anki repetitions reluctantly?

For spaced repetition apps (and ed-tech apps in general) to take over the world they need to see themselves as competing with Netflix, TikTok and YouTube shorts for users' attention. When you scroll through TikTok or YouTube shorts, you never have the experience of failing to understand something. Everything is perfectly comprehensible. There is the novelty and surprisal aspect of not knowing what is coming next. YouTube shorts is a market of clips competing to entertain you the most. Clips are collaboratively filtered by the community and recommended to you based on your watch history. They have high retention because they allow you to quickly "channel zap" and find something new when you get bored.

But while the user interface and algorithms implemented into YouTube shorts and TikTok make them very engaging, the content quality is often extremely bad. It's hard to curate a feed of really high quality educational content that will advance you towards your goals. These systems are black boxes with little opportunity for customisation. They also lack the active recall aspect of spaced repetition systems which help you internalise and reflect on important concepts.

## A Better Recommender System?

Is there potential for a recommender system that blends the best characteristics from spaced repetition, incremental reading and YouTube shorts into one? People will argue that without sensationalist, clickbait content, YouTube shorts and TikTok would lose their addictive power, but my experience in the SuperMemo.Wiki Discord has shown me that people can become hooked on content that improves their life under the right circumstances.

![Image description](https://res.cloudinary.com/practicaldev/image/fetch/s--Wvh_88w_--/c_limit%2Cf_auto%2Cfl_progressive%2Cq_auto%2Cw_800/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/l5u7wvs7jhoj6ubx3zgj.png)

What I dreamt of back in university was a system that could infer my interests from my daily activities, like flashcard reviews, reading my behaviour and browsing habits, and use that information to recommend me videos, articles and podcasts from YouTube that I could watch in the evening after school. I never got anything off the ground until a month ago when I revisited [Erik Bjäreholt's blog post on Open Recommender Systems](https://erik.bjareholt.com/wiki/importance-of-open-recommendation-systems/) and realised that LLMs have made sophisticated, customisable and explainable recommendation systems easier than ever to build!

I think huge advances have suddenly made possible and we need to start exploring what is possible now we can use LLMs as agents, constantly scanning the web on our behalf, searching for golden nuggets that we'll find interesting.

### Open Recommender

## ![GitHub logo](https://res.cloudinary.com/practicaldev/image/fetch/s--A9-wwsHG--/c_limit%2Cf_auto%2Cfl_progressive%2Cq_auto%2Cw_800/https://dev.to/assets/github-logo-5a155e1f9a670af7944dd5e12375bc76ed542ea80224905ecaf878b9157cdefc.svg)[OpenPipe](https://github.com/OpenPipe) / [open-recommender](https://github.com/OpenPipe/open-recommender)

### Using LLMs to implement an open source YouTube video recommendation system.

# [![Open Recommender Logo](https://res.cloudinary.com/practicaldev/image/fetch/s--1mOFz53e--/c_limit%2Cf_auto%2Cfl_progressive%2Cq_auto%2Cw_800/https://raw.githubusercontent.com/bjsi/open-recommender/main/img/logo.webp)](https://raw.githubusercontent.com/bjsi/open-recommender/main/img/logo.webp)    Open Recommender - An open source, LLM-powered YouTube video recommendation system

### ⚠️ Work in Progress... ⚠️

- Build an MVP of the data pipeline
- Iterate on the prompts until 8/10 recommendations are good
- Curate fine tune dataset
- Create a website so people can sign up
- Collect more fine tune data
- Fine tune using [OpenPipe](https://openpipe.ai/)
- Scale to more users
- Add more recommendation sources (e.g. articles, twitters, books, etc.)
- Scale to millions of users

## 🚀 Overview

Welcome to Open Recommender, an open source recommendation system for YouTube. _See the video intro below_

[![Video](https://camo.githubusercontent.com/97940e08fab9c4d43110e065e2a1484d75be6e66ff8c4bf3f3f89bccd8bc7e09/68747470733a2f2f696d672e796f75747562652e636f6d2f76692f4b624277687556707143302f687164656661756c742e6a7067)](https://www.youtube.com/watch?v=KbBwhuVpqC0)

## 🏆 Goals

- Understand your current interests by analyzing your Twitter engagement (likes, retweets, etc.)
- Create a large database of potentially interesting videos
- Recommend interesting sections from videos
- Recommend "timeless" content rather than "trending" content
- Surface "niche bangers" - difficult to find but really high quality content
- Biased towards learning as opposed to entertainment
- Read my blog post for more: [Building an](https://dev.to/experilearning/building-an-llm-powered-open-source-recommendation-system-40fg)…

[View on GitHub](https://github.com/OpenPipe/open-recommender)

For the past month I've been working on a proof of concept for an open source recommender system called Open Recommender. Currently it works by taking your public Twitter data as input, uses LLMs to process it and infer your interests and searches YouTube to curate lists of short 30-60 second clips tailored to your current interests. I wrote [an article about it here](https://dev.to/experilearning/building-an-llm-powered-open-source-recommendation-system-40fg) and made [a video showing an early prototype](https://www.youtube.com/watch?v=KbBwhuVpqC0).

I already have plans to make it even more targeted at an individual's unique interests and prior knowledge - for example it could take arbitrary information sources as input, like the history and probability of recall for all of the information you had added into your spaced repetition system.

I'll also be adding ways to tune the behaviour of the recommender to your personal tastes - the recommendations could exist along a spectrum from appealing to the interests the system knows the learner already has to giving recommendations from new unexplored territory. And because it's implemented using LLMs, you can provide custom instructions using natural language and the LLM can provide understandable explanations for its recommendations.

And I'm also working on an early version of the UI:

![Image description](https://res.cloudinary.com/practicaldev/image/fetch/s--CiiGWf-u--/c_limit%2Cf_auto%2Cfl_progressive%2Cq_66%2Cw_800/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/kowv6ma07ulet3i6qxpi.gif)

If this sounds exciting to you and you are interested in supporting the project, you can [subscribe here](https://buy.stripe.com/bIY7tbco90f23sY9AC) and I'll include you in the test of the UI before it becomes available to anyone else, as well as implement your feedback ASAP. If you have any good ideas, please get in touch with me on Twitter [@experilearning](https://dev.to/experilearning). Thanks for reading!!

[![profile](https://media2.dev.to/dynamic/image/width=64,height=64,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Forganization%2Fprofile_image%2F2584%2F76d5831f-7acd-4123-8083-00818e48de9b.png)\\
Draft.dev](https://dev.to/draft) Promoted

Dropdown menu

- [What's a billboard?](https://dev.to/billboards)
- [Manage preferences](https://dev.to/settings/customization#sponsors)

* * *

- [Report billboard](https://dev.to/report-abuse?billboard=262122)

[![Roadie](https://media2.dev.to/dynamic/image/width=775%2Cheight=%2Cfit=scale-down%2Cgravity=auto%2Cformat=auto/https%3A%2F%2Fi.imgur.com%2FPQ2eJBd.png)](https://roadie.io/blog/7-best-developer-portals-for-enterprise-engineering-teams/?utm_source=draft-dev&bb=262122)

## [What developer portal platforms are enterprises using?](https://roadie.io/blog/7-best-developer-portals-for-enterprise-engineering-teams/?utm_source=draft-dev&bb=262122)

From open-source Backstage to SaaS platforms, the developer portal ecosystem has grown quickly. This guide evaluates seven platforms and explains how they differ in flexibility, maintenance, and cost.

[Read more](https://roadie.io/blog/7-best-developer-portals-for-enterprise-engineering-teams/?utm_source=draft-dev&bb=262122)

Read More


![pic](https://media2.dev.to/dynamic/image/width=256,height=,fit=scale-down,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2F8j7kvp660rqzt99zui8e.png)

[Create template](https://dev.to/settings/response-templates)

Templates let you quickly answer FAQs or store snippets for re-use.

SubmitPreview [Dismiss](https://dev.to/404.html)

Are you sure you want to hide this comment? It will become hidden in your post, but will still be visible via the comment's [permalink](https://dev.to/experilearning/from-spaced-repetition-systems-to-open-recommender-systems-25ab#).


Hide child comments as well

Confirm


For further actions, you may consider blocking this person and/or [reporting abuse](https://dev.to/report-abuse)

[![profile](https://media2.dev.to/dynamic/image/width=64,height=64,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Forganization%2Fprofile_image%2F8431%2F57ccd88f-6269-4347-893f-a0d3f8c5527a.jpg)\\
Bright Data](https://dev.to/bright-data) Promoted

Dropdown menu

- [What's a billboard?](https://dev.to/billboards)
- [Manage preferences](https://dev.to/settings/customization#sponsors)

* * *

- [Report billboard](https://dev.to/report-abuse?billboard=246460)

[![Image of Bright Data and n8n Challenge](https://media2.dev.to/dynamic/image/width=775%2Cheight=%2Cfit=scale-down%2Cgravity=auto%2Cformat=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2Fslp0b1u3ff18kt0s5yf3.png)](https://dev.to/joupify/soc-cert-automated-threat-intelligence-system-with-n8n-ai-5722?bb=246460)

## [SOC-CERT: Automated Threat Intelligence System with n8n & AI](https://dev.to/joupify/soc-cert-automated-threat-intelligence-system-with-n8n-ai-5722?bb=246460)

Check out this submission for the [AI Agents Challenge powered by n8n and Bright Data](https://dev.to/challenges/brightdata-n8n-2025-08-13?bb=246460).

[Read more →](https://dev.to/joupify/soc-cert-automated-threat-intelligence-system-with-n8n-ai-5722?bb=246460)

![DEV Community](https://media2.dev.to/dynamic/image/width=190,height=,fit=scale-down,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2F8j7kvp660rqzt99zui8e.png)

We're a place where coders share, stay up-to-date and grow their careers.


[Log in](https://dev.to/enter?signup_subforem=1) [Create account](https://dev.to/enter?signup_subforem=1&state=new-user)

![](https://assets.dev.to/assets/sparkle-heart-5f9bee3767e18deb1bb725290cb151c25234768a0e9a2bd39370c382d02920cf.svg)![](https://assets.dev.to/assets/multi-unicorn-b44d6f8c23cdd00964192bedc38af3e82463978aa611b4365bd33a0f1f4f3e97.svg)![](https://assets.dev.to/assets/exploding-head-daceb38d627e6ae9b730f36a1e390fca556a4289d5a41abb2c35068ad3e2c4b5.svg)![](https://assets.dev.to/assets/raised-hands-74b2099fd66a39f2d7eed9305ee0f4553df0eb7b4f11b01b6b1b499973048fe5.svg)![](https://assets.dev.to/assets/fire-f60e7a582391810302117f987b22a8ef04a2fe0df7e3258a5f49332df1cec71e.svg)