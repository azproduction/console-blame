# console-blame
[![NPM Version](https://badge.fury.io/js/console-blame.png)](https://npmjs.org/package/console-blame) [![Build Status](https://travis-ci.org/azproduction/console-blame.png?branch=master)](https://travis-ci.org/azproduction/console-blame) [![Coverage Status](https://coveralls.io/repos/azproduction/console-blame/badge.png?branch=master)](https://coveralls.io/r/azproduction/console-blame) [![Dependency Status](https://gemnasium.com/azproduction/console-blame.png)](https://gemnasium.com/azproduction/console-blame)

It highlights and helps to find forgotten console.log calls in runtime. [Live example](http://beta.hstor.org/files/16e/13c/64f/16e13c64f9764d7081430a2e6e12967d.gif)

## Installation

`console-blame` can be installed using `npm`:

```
npm install console-blame --save-dev
```

## Interface

 - `ConsoleBlame(Object consoleObject, String[] trapsList)`
 - `ConsoleBlame(Object consoleObject)`
 - `ConsoleBlame(String[] trapsList)`
 - `ConsoleBlame()`
 - `ConsoleBlame#configure(Object options)` see `Configuration options`
 - `ConsoleBlame#restore()` releases all trapped methods
 - `ConsoleBlame#trap(String[] ...methods)` traps all listed methods
 - `ConsoleBlame#trap()` traps all available methods 

## Configuration options

Can be configured, using `require('console-blame').configure({ ... })`

 - `pathFormat` format of file name, line and column. default: `'%s:%d:%d'`
 - `lineFormat` format of code line. default: `'%d | %s'`
 - `contextSize` number of lines before and after target line. default: `3`
 - `sources` print source code? default: `true`

## Example

**Trap all methods of console**

```js
require('console-blame')();

console.log(123); // Will print debug message
console.error(123); // Will print debug message
```

**Trap only console.log**

```js
require('console-blame')(['log']);

console.log(123); // Will print debug message
```

**Trap only log and error of specific console object**

```js
require('console-blame')(console, ['log', 'error']);

console.log(123); // Will print debug message
```

**Trap all methods and change size of context and line format**

```js 
require('console-blame')().configure({
   contextSize: 5,
   lineFormat: '%d\t%s'
});

console.log(123);
```

**Restore traps**

```js
var blame = require('console-blame')();
console.log(123); // Will print debug message
blame.restore();
console.log(123); // Will NOT print debug message
blame.trap();
console.log(123); // Will print debug message
```
 
## Output example

```
A log message
/home/username/projects/console-blame/lib/index.js:174:9
 169 | attachTrapsTo(console).configure({
 170 |   contextSize: 5,
 171 |   lineFormat: '%d\t%s'
 172 | });
 173 |
 174 | console.log('A log message'); // <<< This line will be highlighted
 175 |
```
