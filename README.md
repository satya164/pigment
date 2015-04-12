# Pigment
A color information, conversion and manipulation library with support for various color models!

## Installation
```bash
$ npm install pigment
```

## Usage
To use **pigment** in your projects, you need to require the node module first.

```javascript
var Color = require("pigment");
```

To be able to perform any operations on a color, you need to create a new color object first.

```javascript
var c = new Color("#f06860");

/* Get the color in hex, rgb, hsl etc. */
c.tohex(); // #f06860
c.torgb(); // rgba(240, 104, 96, 1)
c.tohsl(); // hsla(3, 83%, 66%, 1)

/* Get luminance or darkness of the color */
c.luminance(); // 0.29270422282503833
c.darkness(); // 0.4362666666666666

/* Perform operations on the color */
c.fadeout(.2).mix("#e9f060", .5).fadein(.1).tohex(); // #ebb960
```

Apart from color conversion and manipulation, **pigment** is also able to parse a chunk of text to find out any colors.

```
var colors = Color.parse("Some roses aren't #ff0000, some violets aren't rgb(0, 0, 255), nobody's wrong, except maybe you!")

for (var i = 0, l = colors.length; i < l; i++) {
	console.log(colors[i].tohex()); // #ff0000, #0000ff
}
```

Generating a random color is also easy,

```
Color.random().tohex(); // #a68a4b
```

## Core API
All the functionality in **pigment** is achieved with models. The `addModel` method can be used to add a new color model to **pigment**.

```
Color.addModel(name, model);
```

The model object must consist 3 properties,

1. `match` - A function or a regex which is used to detect if the color is represented in the specific model representation.
2. `frommodel` - A function which converts the color into an object with `red`, `green` and `blue` properties, and an optional `alpha` property.
3. `tomodel` - A function which converts the color to the model representation.

There is also an optional `init` method which is called when instantiating a color object.

Have a look at the `models` directory in the repository for examples.

## Notes
The project is still in its early stages and not feature complete. Use it with caution.