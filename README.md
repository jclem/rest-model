# RestModel

[![Build Status](https://travis-ci.org/jclem/rest-model.svg)](https://travis-ci.org/jclem/rest-model)

`RestModel` is a library for interacting with a REST API in Ember. It aims to
remain as simple as possible, but the ultimate goal will be to gracefully
handle issues like caching, ranges, and deleted records without requiring
methods like side-loaded or side-deleted data in API responses. It is mega-WIP.

## Examples

Given:

```javascript
var Foo = RestModel.extend().reopenClass({
  url: '/foos'
});

var Bar = RestModel.extend().reopenClass({
  url: '/foos/:foo_id/bars'
});
```

List `Foo`s:

```javascript
Foo.all().then(function(foos) {
  console.log(foos);
});
```

List `Bar`s for `Foo` with ID 1:

```javascript
var foo = Foo.create({ id: 1 });
Bar.all(foo).then(function(bars) {
  console.log(bars);
});
```

Find `Foo` #1:

```javascript
Foo.find(1);
```

Find `Bar` #1, which has a `foo_id` of #3::

```javascript
var foo = Foo.create({ id: 3 });
Bar.find(foo, 1);
```

Create a `Bar`, which belongs to `Foo` #1:

```javascript
var foo = Foo.create({ id: 1 });
var bar = Bar.create({ parents: [foo], name: 'Ms. Bar' });
bar.save();
```

Update `bar`:

```javascript
bar.set('name', 'Mr. Bar');
bar.save();
```

## Testing

```sh
$ npm install
$ bower install
$ npm test
```
