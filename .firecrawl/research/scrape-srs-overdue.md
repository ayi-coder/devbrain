I did an informal study on my 13 years of Anki spaced-repetition history to
settle a team question at [RemNote](https://remnote.com/): is our “Anki SM-2” algorithm (and Anki’s
SM-2 algorithm itself) too aggressive when scheduling overdue cards?

Somewhat to my surprise, and also to my embarrassment because I’ve been
defending the current behavior without data for many years, the answer appears
to be yes – although it overshoots by much less than most people who complain
about it think it does. More specifically, it is systematically biased,
overshooting more the more a card is overdue, with the chance of remembering a
card on the review after an overdue review dropping off from my collection
average of around 87% to 75% as the amount of overdueness decreases from a day
to a year:

![Bar graph of answer buttons selected on after-overdue reviews, by days overdue](https://controlaltbackspace.org/assets/images/posts/overdue-sr/by-overdueness.png)

I don’t have enough data beyond 1 year to draw many conclusions, but the trend
at the beginning is clear. It would seem to make sense to tweak the algorithm
to apply less of an overdueness bonus to cards if they are more overdue.

There are some more nuances and things that would be useful to check/explore
next, but this is all I have time to investigate at the moment, so I figured I
would share it as is.

[Read my full report](https://controlaltbackspace.org/assets/attachments/overduecards.html) for more details on how the algorithm currently
works, how I came to these conclusions, and speculation on why the seemingly
theoretically sound approach to adding overdueness bonus might not work as well
in practice. ( [R Markdown source](https://controlaltbackspace.org/assets/attachments/overduecards.rmd) if you want to try reproducing this
yourself on your own collection. Let me know what you find!)

#### Share on

[X](https://x.com/intent/tweet?text=The+SM-2+Algorithm+Actually+Is+Too+Aggressive+on+Substantially+Overdue+Cards%20https%3A%2F%2Fcontrolaltbackspace.org%2Foverdue-handling%2F "Share on X") [Facebook](https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fcontrolaltbackspace.org%2Foverdue-handling%2F "Share on Facebook") [LinkedIn](https://www.linkedin.com/shareArticle?mini=true&url=https://controlaltbackspace.org/overdue-handling/ "Share on LinkedIn") [Bluesky](https://bsky.app/intent/compose?text=The+SM-2+Algorithm+Actually+Is+Too+Aggressive+on+Substantially+Overdue+Cards%20https%3A%2F%2Fcontrolaltbackspace.org%2Foverdue-handling%2F "Share on Bluesky")

## You may also enjoy

## [Understanding False Positive COVID Screening Results](https://controlaltbackspace.org/covid-testing/)


19 minute read



When does a positive COVID test mean you probably don’t have COVID? Fun with Bayes’ Rule.

## [In What Sense Is AI Poetry Indistinguishable from Human Poetry? (Not the One You Think)](https://controlaltbackspace.org/ai-poetry/)


49 minute read



I “distinguished” 84 out of 87 poems. Inability to distinguish is likely reliable only temporarily and under lab conditions.

## [Don’t Measure the Quality of Your Life Using the Temperature of Your Nachos](https://controlaltbackspace.org/nachos/)


15 minute read



A few years back, I read an anecdote somewhere on the web by a guy whose boss
had won an all-expenses-paid trip to see an NFL game with amazing seats. The
fo...

## [Supplement on Emergency Contraception Effectiveness](https://controlaltbackspace.org/ec/)


21 minute read



In my post on contraception, I mentioned emergency contraception only in passing,
as something that was out of scope,
but it’s come to my attention t...

Enter your search term...