# console-blame
[![NPM Version](https://badge.fury.io/js/console-blame.png)](https://npmjs.org/package/console-blame) [![Build Status](https://travis-ci.org/azproduction/console-blame.png?branch=master)](https://travis-ci.org/azproduction/console-blame) [![Coverage Status](https://coveralls.io/repos/azproduction/console-blame/badge.png?branch=master)](https://coveralls.io/r/azproduction/console-blame) [![Dependency Status](https://gemnasium.com/azproduction/console-blame.png)](https://gemnasium.com/azproduction/console-blame)

It highlights and helps to find forgotten console.log calls in runtime

## Installation

`console-blame` can be installed using `npm`:

```
npm install console-blame --save-dev
```

## Options

Can be configured, using `require('console-blame').configure({ ... })`

 - `pathFormat` format of file name, line and column. default: `'%s:%d:%d'`
 - `lineFormat` format of code line. default: `'%d | %s'`
 - `contextSize` number of lines before and after target line. default: `3`
 - `sources` print source code? default: `true`

## Example

```js
// Trap only console.log
require('console-blame')(console, ['log']);

console.log(123); // Will print debug message
```

```js
// Trap all methods of console
require('console-blame')();

console.log(123); // Will print debug message
console.error(123); // Will print debug message
```

```js
// Trap all methods and change size of context and line format 
require('console-blame')(console).configure({
   contextSize: 5,
   lineFormat: '%d\t%s'
});

console.log(123);
```
 
**Output example**

```
/Users/azproduction/Documents/my/console-blame/lib/index.js:174:9
 169 | attachTrapsTo(console).configure({
 170 |   contextSize: 5,
 171 |   lineFormat: '%d\t%s'
 172 | });
 173 |
 174 | console.log(123); // <<< This line will be highlighted
 175 |
123
```
