/**
 * @fileOverview - Color information, conversion and manipulation library - Core.
 * @author - Satyajit Sahoo <satyajit.happy@gmail.com>
 * @license - GPL-3.0+
 */

var Color = (function() {
  var _reserved = [ 'init', 'match', 'format', 'convert', 'depends', 'tomodel', 'frommodel' ],
    _models = {},
    _fn = {};

  _models._internal_ = {
    match: function(c) {
      return (typeof c === 'object' && typeof c.red === 'number' && typeof c.green === 'number' && typeof c.blue === 'number');
    },

    frommodel: function(c) {
      return c;
    },

    tomodel: function() {
      return {
        red: this.red,
        green: this.green,
        blue: this.blue,
        alpha: this.alpha,
      };
    },
  };

  _fn.getType = function(color) {
    var type;

    if (!color) {
      return null;
    }

    for (var model in _models) {
      if (typeof _models[model].match === 'function') {
        if (_models[model].match(color)) {
          type = model;

          break;
        }
      } else if (_models[model].match instanceof RegExp) {
        if (_models[model].match.test(color)) {
          type = model;

          break;
        }
      }
    }

    return type;
  };

  function ColorConstructor(color) {
    var c, type, props, args;

        // Handle situation where called without "new" keyword
    if (this instanceof ColorConstructor === false) {
      return new ColorConstructor(color);
    }

    args = Array.prototype.slice.call(arguments);

    type = _fn.getType(color);

    if (!type) {
      throw new Error('Invalid color ' + color);
    }

    props = [ 'red', 'green', 'blue' ];

    if (typeof _models[type].format === 'function') {
      Object.defineProperty(this, type, {
        value: _models[type].format.apply(this, args),
        writable: false,
      });
    }

    c = _models[type].frommodel.apply(this, args);

    for (var i = 0, l = props.length; i < l; i++) {
      Object.defineProperty(this, props[i], {
        value: (typeof c[props[i]] === 'number' && !isNaN(c[props[i]]) && c[props[i]] >= 0 && c[props[i]] <= 255) ? c[props[i]] : 0,
        writable: false,
        enumerable: true,
      });
    }

    Object.defineProperty(this, 'alpha', {
      value: (typeof c.alpha === 'number' && !isNaN(c.alpha) && c.alpha >= 0 && c.alpha <= 1) ? c.alpha : 1,
      writable: false,
      enumerable: true,
    });

    Object.defineProperty(this, '_color', {
      value: color,
      writable: false,
    });

    Object.defineProperty(this, '_type', {
      value: type,
      writable: false,
    });

    for (var model in _models) {
      if (model !== type && typeof _models[model].convert === 'function') {
        Object.defineProperty(this, model, {
          value: _models[model].convert.apply(this, args),
          writable: false,
        });
      }

      if (typeof _models[model].init === 'function') {
        _models[model].init.apply(this, args);
      }
    }
  }

  ColorConstructor.addModel = function(name, model) {
    if (typeof name !== 'string' || !name) {
      throw new Error('Invalid model name ' + name);
    }

    if (typeof model !== 'object') {
      throw new Error('Invalid model object ' + model + ' for ' + name);
    }

    if (model.depends) {
      if (Array.isArray(model.depends)) {
        for (var i = 0, l = model.depends.length; i < l; i++) {
          if (typeof model.depends[i] === 'string') {
            if (!_models[model.depends[i]]) {
              throw new Error('Unsatisfied dependency ' + model.depends[i] + ' for ' + name);
            }
          } else {
            throw new Error('Invalid dependency ' + model.depends[i] + ' for ' + name);
          }
        }
      } else {
        throw new Error('Invalid depends array ' + model.depends + ' in ' + name);
      }
    }

    if ('match' in model) {
      if (typeof model.match !== 'function' && !(model.match instanceof RegExp)) {
        throw new Error('Invalid match method ' + model.match + ' in ' + name);
      }

      if (typeof model.frommodel !== 'function') {
        throw new Error('Invalid frommodel method ' + model.frommodel + ' in ' + name);
      }
    }

    if ('tomodel' in model && typeof model.tomodel !== 'function') {
      throw new Error('Invalid tomodel method ' + model.tomodel + ' in ' + name);
    }

    for (var prop in model) {
      if (_reserved.indexOf(prop) > -1) {
        continue;
      }

            // Add extra methods
      ColorConstructor.prototype[prop] = model[prop];
    }

        // Add helper methods to convert from and to the model
    if (typeof model.frommodel === 'function') {
      ColorConstructor.prototype['from' + name] = function() {
        var args = Array.prototype.slice.call(arguments);

        args = args.length ? args : [ this._color ];

        return model.frommodel.apply(this, args);
      };
    }

    if (typeof model.tomodel === 'function') {
      ColorConstructor.prototype['to' + name] = function() {
        var args = Array.prototype.slice.call(arguments);

        return model.tomodel.apply(this, args);
      };
    }

    _models[name] = model;
  };

  ColorConstructor.random = function() {
    var r = function() {
      return Math.floor(Math.random() * 256);
    };

    return new ColorConstructor({
      red: r(),
      green: r(),
      blue: r(),
    });
  };

  ColorConstructor.parse = function(str) {
    var c, map, colors, words, id;

    if (typeof str !== 'string') {
      throw new Error('Invalid string ' + str);
    }

    map = {};
    colors = [];

    words = str.toLowerCase().match(/(\w+\((\s?(\d+\.?(\d+)?)%?\s?,?)+\)|[^,;:!'"\.\?\s]+|\S+)/gi, '') || [];

    for (var i = 0, l = words.length; i < l; i++) {
      if (_fn.getType(words[i])) {
        try {
          c = new ColorConstructor(words[i]);
        } catch (e) {
          continue;
        }

        id = c.red + ':' + c.green + ':' + c.blue + ':' + c.alpha;

                // Only list unique colors
        if (map[id]) {
          continue;
        }

        map[id] = true;

        colors.push(c);
      }
    }

    return colors;
  };

  ColorConstructor.__defineGetter__('models', function() {
    return Object.keys(_models).filter(function(m) {
      return (m !== '_internal_');
    });
  });

  return ColorConstructor;
}());

module.exports = Color;
