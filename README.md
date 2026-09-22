## SUchedule

This project allows Sabancı University students to create their schedule with a friendly user interface.

## Motivation

This project was built with the hopes of making the course registration period easier for SU students.

## Code

This project was built using EcmaScript 2016 (ES6) and jQuery (3.3.1).

## Course Data

SUchedule offers the last three terms on bannerweb, each with its own schedule. The terms and their data
versions are listed in `js/terms.js`, and the courses of a term are in `data-<term>-v<version>.min.json`.
Every day `.github/workflows/scrape.yaml` runs `scraper/update.py`, which moves the window forward when
bannerweb adds a new term, re-scrapes the supported terms and stores the ones that changed under the next
version number.

## External Libraries

[jQuery](https://github.com/jquery/jquery)

[ClipboardJS](https://github.com/zenorocha/clipboard.js)

## Fonts

The main font of the website is [Roboto](https://fonts.google.com/specimen/Roboto) and notifications are
written in Consolas.

For the icons, [Fontello](http://fontello.com/) has been used.

## Contribution

If you are a SU student and would like to contribute, please contact me. If you are not, and you would like
to create a similar schedule building website with your own data, feel free to do so.

## License

This project is licensed under the terms of the MIT license.              
                