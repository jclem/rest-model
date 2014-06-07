# RestModel

[![Build Status](https://travis-ci.org/jclem/rest-model.svg)](https://travis-ci.org/jclem/rest-model)

RestModel is a library for interacting with a REST API in Ember. Its goal is to
provide a library with predictable behavior and which can be easily extended to
meet custom needs.

## Documentation

This readme, and more detailed work-in-progress
[here, on GitHub pages](http://dingus.io/rest-model/).

## Install

```bash
bower install rest-model --save
```

## Use

### Basic Use

Using RestModel is as simple as extending it to create a custom model class, and
providing a URL for that model:

```javascript
var App = RestModel.extend().reopenClass({
  url: '/apps'
});
```

`App` can now be used to fetch resources from the `/apps` endpoint:

```javascript
// Fetch all apps (GET /apps):
App.all().then(function(apps) {
  apps[0].constructor === App;
});

// Fetch a single app (GET /apps/:id):
App.find(1).then(function(app) {
  app.constructor === App;
});
```

`App`s can also be created, fetched, updated, and destroyed:

```javascript
var existingApp = App.create({ id: params.id });
existingApp.fetch().then(function(existingApp) {
  existingApp.get('name') === 'existing-app-name';
});

var newApp = App.create({ name: 'new-app-name' });
newApp.save().then(function(newApp) {
  newApp.get('id') === 2;
  return newApp.delete();
}).then(function() {
  // newApp has been deleted
});
```

### Working with Nested Resources

Working with nested resources is as simple as providing a nested URL with
placeholder segments, and providing parent objects and keys for each record:

```javascript
var Post = RestModel.extend().reopenClass({
  url: '/posts'
});

var Comment = RestModel.extend().reopenClass({
  url: '/posts/:post/comments'
});

var post = Post.create({ id: 1 });

Comment.all(post).then(function(comments) { // GET /posts/1/comments
  comments[0].constructor === Comment;
});

Comment.find(post, 2).then(function(comment) { // GET /posts/1/comments/2
  comment.constructor === Comment;
});

var comment = Comment.create({ parents: [post], body: 'hello' });
comment.save().then(function(comment) { // POST /posts/1/comments
  comment.constructor === Comment;
});
```

There is no concept of belongs-to/has-many in RestModel. All models are managed
individually, and `parents` can be used on any record&mdash;their primary keys
will be interpolated as is appropriate into the URL.

### Custom Namespaces

If resources are behind a custom namespace, one can be provided via the
`namespace` property on the class:

```javascript
var Model = RestModel.extend().reopenClass({
  namespace: 'api'
});

var App = Model.extend().reopenClass({
  url: '/apps'
});

App.all(); // GET `/api/apps`
```

### Custom Primary Keys

Your API may allow you to find resources by, for example, both `id` and `name`.
RestModel supports this via the `primaryKeys` array property on the class, which
defaults to `['id']`. Any time RestModel needs a primary key to fetch or save a
record, it will iterate over these keys in order until it finds one for which
the model has a value.

```javascript
var App = RestModel.extend().reopenClass({
  url: '/apps',
  primaryKeys: ['id', 'name']
});
```

Now, say a user visits `/apps/my-app` in your Ember app. Your route will want
to fetch the `App` model for them, and RestModel can fetch it by `name`, since
that value is provided in `primaryKeys`:

```javascript
var AppsRoute = Ember.Route.extend({
  model: function(params) {
    return App.create({ name: params.name }).fetch();
  }
});
```

All subsequent API requests for that `App` instance will be made using `id`,
assuming your API returns this property.

### Determining If a Record Has Changed

RestModel provides an `isDirty` property on each instance that returns `true` if
attributes on the record have been changed from their original values. When a
record is successfully `save()`d, the new values are considered the "original
values".

In order to determine `isDirty`, RestModel requires that you provide an array
called `attrs` that contains the attributes to dirty check against:

```javascript
var App = RestModel.extend({
  attrs: ['name']
}).reopenClass({
  url: '/apps'
});

var app = App.create({ name: 'foo' });
app.get('isDirty'); // false
app.set('name', 'bar');
app.get('isDirty'); // true
```

### Reverting a Changed Record

Assuming that a record has an `attrs` array defined, it can be reverted to its
original values if it has changed. Remember that changing a record and then
saving it will cause the record to consider its new properties its "original
properties", and it won't revert.

```javascript
var app = App.create({ name: 'foo' });
app.get('name'); // 'foo'
app.set('name', 'bar');
app.get('name'); // 'bar'
app.revert();
app.get('name'); // 'foo'
```

### Serializing a Record for Saving/Updating

When a record is saved or updated, `#serialize` is called on it, which is a
method that returns a JSON string. By default, this method will either serialize
any properties in a `serializedProperties` property array on the record, or it
will simply call `JSON.stringify(this)` if no such property exists.

This method can be overridden easily, as long as it returns a JSON string.

### Deserializing Records

When a record is returned from the API, `::deserialize` is called on its class,
with the API response object as the argument. By default, this method simply
calls `return this.create(object)`, returning an instance of the class.

When an array is returned, `::deserializeArray` is called on its class, with the
API response array as the argument. By default, this simply returns a map of
calling `::deserialize` with each member of the array.

These methods can be overridden for custom API response deserialization.

### Setting Custom Request Headers

Each class can choose to implement a `getBeforeSend` function. This function
should return a function whose single argument is a jQuery XMLHttpRequest
object (`jqXHR`). Custom request headers can be added and removed here, as it
will be called on every AJAX request for this class.

The `getBeforeSend` method itself receives an object of options, including
things like the request method (e.g. `'GET'`) to be used by the impending AJAX
request.

```javascript
var App = RestModel.extend().reopenClass({
  url: '/apps',

  getBeforeSend: function(options) {
    return function(jqXHR) {
      jqXHR.setRequestHeader('foo', 'bar');
    }
  }
})
```

### Caching

Although caching is in an early state in RestModel, there is basic caching
functionality, which uses `localStorage`. In order to activate it, set `cache`
to `true` on the class:

```javascript
var App = RestModel.extend().reopenClass({
  cache: true,
  url: '/apps'
});
```

The cache will keep a single representation of every record of that class it has
fetched, and for every separate URL, either an array of record primary keys or
a single record primary key for that URL.

Once a request to an endpoint has been made once (and then cached), subsequent
request promises will immediately resolve with the cached value. An API request
will be triggered in the background, and the cached value (both in the cache and
in the record or array of records the promise was resolved with) will be
updated.

On endpoints that return arrays, the cache will add, update, and remove* the
appropriate records.

On endpoints that return single objects, the cache will only update the cached
object.

As long as what's rendered by your Ember app is the same array or object
returned by a RestModel method (e.g. `::all`, `#find`), your view should render
immediately, and then update once the background API request completes.

_*This can currently break for paginated APIs, as it is impossible to
determine whether a record has been removed or simply relocated to a different
page or range._

## Building

Before a release, RestModel should be built with a non-uglified and an uglified
version into its `dist` directory:

```sh
npm install
npm run build
```

## Testing

```sh
$ npm install
$ bower install
$ npm test
```
