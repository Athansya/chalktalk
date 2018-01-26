"use strict";

(function(){
function AtypicalModuleGenerator() {
   var AT = {};

   // This internal variable holds all of our types, with keys being their names and values
   // being their constructors.
   var _types = {};

   // This internal variable holds all our generic types, with keys being their names and values
   // being their metaconstructor functions (i.e. functions that return constructors).
   var _genericTypes = {};

   // This internal variable will hold all our conversion functions, in the following structure:
   // {
   //     typename_converted_from: {
   //         typename_converted_to_1: function(value) {...}
   //         typename_converted_to_2: function(value) {...}
   //         ...
   //     }
   //     ...
   // }
   var _conversions = {};

   // This internal variable holds information about which types have defined broad conversions
   // via an intermediary to any destination type. The format is this:
   // {
   //    source_typename: [intermediary_typename_1, intermediary_typename_2, ...]
   //    ...
   // }
   var _intermediaryConversionsToAnyDestination = {};

   // This internal variable holds information about which types have defined broad conversions
   // via an intermediary from any source type. The format is this:
   // {
   //    destination_typename: [intermediary_typename_1, intermediary_typename_2, ...]
   //    ...
   // }
   var _intermediaryConversionsFromAnySource = {};

   // Utility function to get the type name from a variable when you don't know whether they're
   // strings or constructor functions.
   //
   // constructorOrName: Either a function (returns its name), or a string (returns the string
   //                    unchanged). If any other value (e.g. null) is passed in, this function
   //                    just returns the input.
   function _typename(constructorOrName) {
      if (typeof constructorOrName === "function") {
         return constructorOrName.name;
      }
      else {
         return constructorOrName;
      }
   }
   
   // Internal function for checking whether a type is a concrete subtype of a generic type.
   function _isGenericType(type) {
      return typeof type.prototype.genericType === "function";
   }

   // Convenience function. Returns true iff func is a function that takes in exactly n arguments.
   function _isFunctionOfNArguments(func, n) {
      return typeof func === "function" && func.length === n;
   }
   
   // Base for all types. Contains some common functionality needed in all of them.
   AT.Type = function() {};
   AT.Type.prototype = {
      // Converts this object to another type, returning the converted object or undefined
      // if no conversion exists.
      //
      // type: Name or constructor of the destination type. Must be a type that's already been
      //       defined.
      convert: function(type) {
         let typename = _typename(type);
         type = AT.typeNamed(typename);
         if (!AT.typeIsDefined(type)) {
            console.error("Type " + typename + " not defined.");
            return undefined;
         }
         if (type === this.type) {
            return this;
         }

         var conversionFunction = _conversionFunction(this.type, type);
         if (conversionFunction === undefined) { return undefined; }
         else { return conversionFunction(this); }
      },

      // Checks whether a conversion function between this object and another type exists.
      //
      // typename: Name or constructor of the type you want to convert to. Must be a type that's
      //           already been defined.
      canConvert: function(type) {
         return AT.canConvert(this.type, type);
      },

      // Returns whether or not this object is of a primitive type. Types are considered to be
      // primitive if they have a "toPrimitive" function in their definition.
      isPrimitive: function() {
         return AT.isPrimitive(this.type);
      },

      // Helper function for defining an immutable property on this object.
      // Meant to be used primarily in initializers, and not anywhere else.
      //
      // propertyName: A string containing the desired name of the property.
      // value: The value you want it to have. This cannot be changed later.
      _set: function(propertyName, value) {
         if (typeof propertyName !== "string") {
            console.error(
               "Attempted to define a property with non-string name ("+propertyName+")");
            return;
         }
         Object.defineProperty(this, propertyName, {value: value, writeable: false});
      }
   };

   // Checks whether a type with the given name is already defined.
   // 
   // type: The name or constructor of the type you want to check for.
   AT.typeIsDefined = function(type) {
      let typename = _typename(type);
      return typeof(typename) === "string" && _types.hasOwnProperty(typename);
   };

   // Returns whether or not this type is a primitive type. Types are considered to be
   // primitive if they have a "toPrimitive" function in their definition.
   //
   // type: The name or constructor for the type that you wish to check. Should be an Atypical
   //       type name that has already been defined. If not, returns false.
   AT.isPrimitive = function(type) {
      let typename = _typename(type);
      return (AT.typeIsDefined(type)
         && typeof _types[typename].prototype.toPrimitive === "function");
   };

   // Returns the constructor function for the given type.
   //
   // typename: The name of the type you want the function for. Should be the string name of an
   //           Atypical type that has already been defined. If not, returns undefined.
   AT.typeNamed = function(typename) {
      if (typeof typename !== "string" && !AT.typeIsDefined(typename)) {
         return undefined;
      }
      return _types[typename];
   };

   // Checks whether you can convert from one type to another.
   //
   // sourceType: The name or constructor of the type you'd like to convert from.
   //             Must be already defined.
   // destinationType: The name or constructor of the type you'd like to convert from.
   //                  Must be already defined.
   AT.canConvert = function(sourceType, destinationType) {
      return _conversionFunction(sourceType, destinationType) !== undefined;
   }

   // Utility function for converting a value to a given Atypical type.
   AT.wrapOrConvertValue = function(type, value) {
      if (!(value instanceof type)) {
         if (value instanceof AT.Type) {
            if (value.canConvert(type)) {
               value = value.convert(type);
            }
            else {
               throw AT.ConstructionError("Error converting an argument, "
                  + "must be convertible to " + type.name);
            }
         }
         else {
            value = new type(value);
         }
      }
      return value;
   }

   // Given a type, returns a nicely-formatted version of its type name.
   // This is important for generic types. By default, generic types end up with typenames like
   // "$Function_$$Array_$Float$_$$Array_$$Pair_$Int$Float$_$_$_", which is very hard to read. 
   // This function instead prints them out in a more human-readable format such as 
   // "Function(Array(Float), Array(Pair(Int, Float)))".
   AT.prettyTypename = function(type) {
      if (!type.prototype.genericType) {
         return type.name;
      }
      else {
         let typename = type.prototype.genericType.name + "(";
         for (let i = 0; i < type.prototype.typeParameters.length; i++) {
            if (i !== 0) {
               typename += ", ";
            }
            typename += AT.prettyTypename(type.prototype.typeParameters[i]);
         }
         typename += ")";
         return typename;
      }
   }

   // TODO: DOC. helper function for getting explicitly-defined conversions (and explicit
   // intermediary conversions).
   function _explicitConversionFunction(sourceType, destinationType) {
      let sourceTypename = _typename(sourceType);
      let destinationTypename = _typename(destinationType);
      return _conversions[sourceTypename][destinationTypename];
   }

   // TODO: DOC. helper function for getting generic types' conversion functions
   function _genericConversionFunction(sourceType, destinationType) {
      if (_isGenericType(sourceType) && _isGenericType(destinationType)) {

         // Do some special processing for conversions between 2 types with the same generic type
         // and a generic conversion function
         if (sourceType.prototype.genericType === destinationType.prototype.genericType
            && sourceType.prototype.changeTypeParameters !== undefined)
         {
            // Can't convert if the type parameters are not convertible
            if (!sourceType.prototype.canChangeTypeParameters(
               destinationType.prototype.typeParameters))
            {
               return undefined;
            }

            return function(sourceValue) {
               return sourceValue.changeTypeParameters(destinationType.prototype.typeParameters);
            }
         }
      }
      if (_isGenericType(sourceType)) {
         // Check for arbitrary rules of conversion
         if (sourceType.prototype.canConvertToType !== undefined
            && sourceType.prototype.canConvertToType(destinationType))
         {
            return function(sourceValue) {
               return sourceValue.convertToType(destinationType);
            }
         }
      }
      if (_isGenericType(destinationType)) {
         if (destinationType.prototype.canConvertFromType !== undefined
            && destinationType.prototype.canConvertFromType(sourceType))
         {
            return function(sourceValue) {
               return destinationType.prototype.convertFromType(sourceValue);
            }
         }
      }
      return undefined;
   }

   function _directConversionFunction(sourceType, destinationType) {

      // Explicitly-defined conversions override everything else
      let explicitConversion = _explicitConversionFunction(sourceType, destinationType);
      if (explicitConversion) { return explicitConversion; }

      // Generic types have special rules for conversions
      let genericConversion = _genericConversionFunction(sourceType, destinationType);
      if (genericConversion) { return genericConversion; }

      return undefined;
   }

   // TODO: DOC. helper function for looking for broad intermediary conversions
   function _broadIntermediaryConversionFunction(sourceType, destinationType) {
      let sourceTypename = _typename(sourceType);
      let destinationTypename = _typename(destinationType);
      sourceType = AT.typeNamed(sourceTypename);
      destinationType = AT.typeNamed(destinationTypename);
      
      function findIntermediaryConversion(sourceTypename, destinationTypename,
                                          possibleIntermediaries)
      {
         if (possibleIntermediaries !== undefined) {
            // Iterate backwards so that later definitions are prioritized
            for (let i = possibleIntermediaries.length - 1; i >= 0; i--) {

               let intermediaryTypename = possibleIntermediaries[i];
               let intermediaryType = AT.typeNamed(intermediaryTypename);

               let sourceToIntermediary = _directConversionFunction(sourceType, intermediaryType);
               if (sourceToIntermediary) {

                  let intermediaryToDestination = _directConversionFunction(
                     intermediaryType, destinationType);

                  if (intermediaryToDestination) {
                     return function(value) {
                        return intermediaryToDestination(sourceToIntermediary(value));
                     };
                  }
               }
            }
         }
         return undefined;
      }

      let intermediaryConversionFunction = findIntermediaryConversion(
         sourceTypename, destinationTypename,
         _intermediaryConversionsFromAnySource[destinationTypename]);
      
      if (intermediaryConversionFunction !== undefined) {
         return intermediaryConversionFunction;
      }

      intermediaryConversionFunction = findIntermediaryConversion(
         sourceTypename, destinationTypename,
         _intermediaryConversionsToAnyDestination[sourceTypename]);

      if (intermediaryConversionFunction !== undefined) {
         return intermediaryConversionFunction;
      }
   }

   // Internal function for retrieving the conversion function between two types.
   // Returns undefined if the conversion does not exist.
   //
   // sourceType: The name or constructor of the type you're converting from.
   // destinationType: The name or constructor of the type you're converting to.
   function _conversionFunction(sourceType, destinationType) {
      let sourceTypename = _typename(sourceType);
      let destinationTypename = _typename(destinationType);
      sourceType = AT.typeNamed(sourceTypename);
      destinationType = AT.typeNamed(destinationTypename);

      if (sourceType === destinationType) {
         // Same types, return the identity function
         return function(x) { return x; }
      }

      let directConversion = _directConversionFunction(sourceType, destinationType);
      if (directConversion) { return directConversion; }

      // Second-last option: broad intermediary conversions
      let broadIntermediaryConversion = _broadIntermediaryConversionFunction(
         sourceType, destinationType);
      if (broadIntermediaryConversion) { return broadIntermediaryConversion; }

      // Give up, nothing works!

      return undefined;
   };

   function _validateTypename(typename) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(typename)) {
         console.error("Typename must follow Javascript identifier syntax, and must not contain "
            + "a dollar sign.");
         return false;
      }
      if (AT.typeIsDefined(typename)) {
         console.error("A type with the name " + typename + " is already defined.");
         return false;
      }
      if (AT[typename] !== undefined) {
         console.error("Cannot define a type with the name " + typename
            + ", as it overlaps with an existing property of the AT object.");
         return false;
      }
      return true;
   }

   // Function to build an Atypical type. Sets up the correct prototype, the required functions,
   // and so on, returning the constructor function for that type, or undefined if the type
   // definition fails. Also adds the constructor function to the AT object, so that you can
   // access it with AT.YourTypeNameHere.
   //
   // implementation: An object containing the implementation details of the type. 
   //
   //                 The following properties MUST be defined on this object:
   //
   //                 typename: A string containing the name of the type. Must be unique and
   //                           follow Javascript identifier syntax, must not contain a dollar
   //                           sign, and must be a type name that has not already been defined
   //                           and does not overlap with any existing functions or variables
   //                           on the AT object (e.g. hasOwnProperty, defineType).
   //
   //                           This property will NOT be copied to objects of this type. To
   //                           access the typename of an object, use object.type.name.
   //
   //                 init: Initialization function. Should take the same arguments as your
   //                       constructor and handle all initialization logic. Should also do any
   //                       required validation of the arguments and throw a ConstructionError if
   //                       incorrect arguments are provided.
   //
   //                 The following properties MAY be defined on this object:
   //
   //                 toPrimitive: Should be a function that returns a simple, unwrapped
   //                              Javascript object that is equivalent to this type.
   //                              (E.g. the Float type can simply return a Javascript float).
   //                              Types that define this function are considered to be
   //                              "primitive types", and are given some special treatment.
   //                              They should also have an init function of one argument that
   //                              allows you to convert these primitive JS values back into
   //                              Atypical objects.
   //
   //                 The following properties MUST NOT be defined on this object:
   //
   //                 type: This property will be set to the type constructor for this type. Any
   //                       custom value will be overridden.
   //
   //                 genericType: This property is reserved for sub-types of generic types only.
   //
   //                 Also be careful to avoid name collisions with AT.Type convenience 
   //                 functions, such as "convert", "canConvert", etc.
   //                 
   //                 This object may also contain any other functions and elements that are
   //                 required for this type.
   AT.defineType = function(implementation) {
      if (typeof implementation.init !== "function") {
         console.error("Initialization function is required when creating a new type.");
         return undefined;
      }
      if (typeof implementation.typename !== "string") {
         console.error("Typename string is required when creating a new type.");
         return undefined;
      }
      if (!(typeof implementation.genericType === "function"
         || _validateTypename(implementation.typename)))
      {
         return undefined;
      }

      // For reasons I don't entirely understand, doing something like this:
      //
      //     var AtypicalType = function() {
      //         this.init.apply(this, arguments);
      //     }
      //     
      // And then returning AtypicalType at the end of the function, ends up making the
      // Chrome developer tools infer the name of EVERY SINGLE TYPE defined using this
      // function as "AtypicalType", leaving you debugging monstrosities like this in
      // the console:
      // 
      //     AtypicalType {x: AtypicalType, y: AtypicalType, z: AtypicalType}
      //
      // So I'm making a deal with the devil and using "eval" instead. Below, we set 
      // AtypicalType to a function like this:
      //
      //     function typename() {
      //         this.init.apply(this, arguments);
      //     }
      //     
      // This causes the Chrome dev tools to pick up the typename as the actual display name
      // of the type, which is much better:
      //
      //     Vector3 {x: Float, y: Float, z: Float}
      // 
      // It also should set the .name property of the constructor to the name of the type as
      // well, in a way that is hopefully cross-browser supported. This allows us to go from the
      // constructor function to the name of the type easily.
      // 
      // Restricting the typename as I did above should keep this from being used for
      // too much evil.
      // Bless me father, for I have sinned.
      var AtypicalType = eval("(function() {\n" +
         "return function " + implementation.typename + "() {\n" +
            "this.init.apply(this, arguments);\n" +
         "};\n" +
      "})();");

      var proto = Object.create(AT.Type.prototype);

      for (var element in implementation) {
         if (element !== "typename") {
            proto[element] = implementation[element];
         }
      }
      proto.type = AtypicalType;

      AtypicalType.prototype = proto;

      _types[implementation.typename] = AtypicalType;
      
      // Initialize conversion metadata
      _conversions[implementation.typename] = {};
      _intermediaryConversionsFromAnySource[implementation.typename] = [];
      _intermediaryConversionsToAnyDestination[implementation.typename] = [];

      AT[implementation.typename] = AtypicalType;

      return AtypicalType;
   };

   // This function, when called, registers a generic type with Atypical. Unlike the
   // AT.defineType function, which returns a constructor (and puts that constructor in the 
   // AT module), this function returns (and adds to the AT object) a metaconstructor, a 
   // function that RETURNS constructor functions when given one or more types as arguments.
   // For example:
   //
   // AT.defineGenericType({ typename: "Pair", ... });
   // let floatIntValue = new (AT.Pair(AT.Float, AT.Int))(5.6, 7);
   //
   // (Unfortunately, the extra parentheses are required due to JS syntax limitations.
   //  One way around that is to assign the returned constructor to a variable,
   //  e.g. let FloatIntPair = AT.Pair(AT.Float, AT.Int))
   //  
   // implementation: An object describing the implementation details of the generic type. Any
   //                 properties added to this object, except the special properties described
   //                 below, will be set as properties of every object of every instance of this
   //                 generic type.
   //
   //                 The following properties MUST be defined on this object:
   //                 
   //                 typename: The name of the generic type as a string.
   //                           This must be a valid JS identifier and must not contain a dollar
   //                           sign. In addition, this must not be the same as any previously-
   //                           defined types or any existing properties of the AT object
   //                           (e.g. "hasOwnProperty", "defineType", etc.), as the
   //                           metaconstructor will be added to the AT object under this name.
   //                           Typenames for all concrete subtypes of this generic type will be
   //                           auto-generated based on this name and the names of the type
   //                           parameters.
   //
   //                 init: This is the initialization function for all concrete subtypes of this
   //                       generic type. To access the type parameters, use the
   //                       this.typeParameters property, as it will be set to an array of the
   //                       type parameters each concrete subtype was created with.
   //
   //                 The following properties MAY be defined on this object:
   //
   //                 changeTypeParameters: If defined, this allows generic types to be
   //                                       automatically convertible between different subtypes
   //                                       of the same generic type if their type paramters are
   //                                       convertible.
   //                                       By default, only generic types with the same number of
   //                                       type parameters, where each type parameter in the
   //                                       source type is convertible to its corresponding
   //                                       parameter in the destination type, will be set as
   //                                       automatically convertible. For example, if this
   //                                       function is defined on our Pair example above, type A
   //                                       is convertible to  type X, and type B is convertible
   //                                       to type Y, then Pair(A, B) will be automatically
   //                                       convertible to Pair(X, Y) by using this function as
   //                                       the conversion function.
   //                                       This behaviour can be changed by defining the
   //                                       canChangeTypeParameters function.
   //                                       If this is defined, it MUST be defined as a function
   //                                       of one argument, taking in only an array of the new
   //                                       type parameters, and returning a new instance of the
   //                                       converted object of the new type.
   //
   //                 canChangeTypeParameters: This function determines under which conditions
   //                                          different subtypes of the same generic types are
   //                                          to be convertible to each other. This allows for
   //                                          customization of the conditions under which 
   //                                          automatic generic conversion is possible.
   //                                          If defined, this must be a function of one argument
   //                                          taking in only the array of the new type parameters,
   //                                          returning only true if the conversion is allowed
   //                                          and false if it is not.
   //
   //                 convertToTypeParameter, convertFromTypeParameter:
   //                      These are optional functions that allow concrete subtypes of this
   //                      generic type to be automatically made convertible with their type
   //                      parameters. For example, if this function is defined on our Pair
   //                      example above, then these could be defined to automatically allow 
   //                      Pair(Float, Int) to be convertible to and/or from Float and/or Int.
   //
   //                      convertToTypeParameter must be defined as a function of one argument
   //                      taking in the index of the type parameter this object should be
   //                      converted to, and returning the converted object. In this function,
   //                      you may use "this" to access any properties of the object to be
   //                      converted.
   //
   //                      convertFromTypeParameter must be defined as a function of two 
   //                      arguments taking in the index of the type parameter this object
   //                      should be converted from and the value it should be converted from
   //                      (which is guaranteed to be an object of the same type as the type
   //                      parameter of the given index). It should return the converted object
   //                      of this generic type. In this function, you may use "this" to access
   //                      any properties of the PROTOTYPE of this generic type (e.g. anything
   //                      defined in this implementation object, as well as properties like
   //                      this.type and this.typeParameters, but not anything defined in the
   //                      init function).
   //
   //                      If these functions are defined, and the corresponding
   //                      canConvertTo/FromTypeParameter functions are not, Atypical will assume
   //                      that this generic type can be converted to or from all of its type
   //                      parameters, and will automatically define
   //                      canConvertTo/FromTypeParameter functions to reflect that.
   //
   //                 canConvertToTypeParameter, canConvertFromTypeParameter:
   //                      Must be defined as a function taking in only one argument, an index
   //                      into the type parameters list. Must return true or false.
   //
   //                      Allows a generic type to restrict which type parameters this generic
   //                      type can be converted to or from. For example, if these functions return
   //                      true only when the index is 0, then concrete subtypes of this generic
   //                      type will only be convertible to/from the type specified in the first
   //                      type parameter.
   //
   //                      In this function, you may use "this" to access any properties of the
   //                      PROTOTYPE of this generic type (e.g. anything defined in this
   //                      implementation object, as well as properties like this.type and
   //                      this.typeParameters, but not anything defined in the init function).
   //                 
   //                 TODO: DOCUMENT convertToType, convertFromType, and the corresponding canConverts
   //
   //                 The following proeprties MUST NOT be defined on this object:
   //
   //                 type: Will be set to the constructor function of the type of every
   //                       instance.
   //                 
   //                 genericType: Will be set to the metaconstructor of the generic type of
   //                              every instance.
   //                 
   //                 typeParameters: Will be set to an array of the type parameters this type
   //                                 was instantiated with.
   AT.defineGenericType = function(implementation) {
      if (typeof implementation.init !== "function") {
         console.error("Initialization function is required when creating a new generic type.");
         return undefined;
      }
      if (typeof implementation.typename !== "string") {
         console.error("Typename string is required when creating a new generic type.");
         return undefined;
      }
      if (!_validateTypename(implementation.typename)) {
         return undefined;
      }

      // Check conversion function between different instances of this generic type
      if (implementation.changeTypeParameters !== undefined) {
         if (!_isFunctionOfNArguments(implementation.changeTypeParameters, 1)) {
            console.error("Error defining generic types: changeTypeParameters "
               + "must be a function of one argument.");
            return undefined;
         }

         if (implementation.canChangeTypeParameters !== undefined) {
            if (!_isFunctionOfNArguments(implementation.canChangeTypeParameters, 1)) {
               console.error("Error defining generic types: canChangeTypeParameters "
                  + "must be a function of one argument.");
               return undefined;
            }
         }
         else {
            implementation.canChangeTypeParameters = function(newTypeParams) {
               if (this.typeParameters.length !== newTypeParams.length) {
                  return false;
               }
               for (let i = 0; i < newTypeParams.length; i++) {
                  if (!AT.canConvert(this.typeParameters[i], newTypeParams[i])) {
                     return false;
                  }
               }
               return true;
            }
         }
      }

      if (implementation.convertToTypeParameter !== undefined) {
         if (!_isFunctionOfNArguments(implementation.convertToTypeParameter, 1)) {
            console.error("Error defining generic types: convertToTypeParameter "
               + "must be a function of one argument taking in only the index.");
            return undefined;
         }

         if (implementation.canConvertToTypeParameter === undefined) {
            // If the user didn't define a restriction function for conversion, define
            // a basic one ourselves.
            implementation.canConvertToTypeParameter = function(index) {
               return index < this.typeParameters.length;
            }
         }
         else if (!_isFunctionOfNArguments(implementation.canConvertToTypeParameter,1)) {
            // If they did, though, validate it.
            console.error("Error defining generic types: canConvertToTypeParameter "
               + "must be a function of one argument taking in only the index.");
            return undefined;
         }
      }
      else {
         // If they didn't define a conversion function, make sure canConvert... always is false.
         implementation.canConvertToTypeParameter = function(index) {
            return false;
         }
      }

      if (implementation.convertFromTypeParameter !== undefined) {
         if(!_isFunctionOfNArguments(implementation.convertFromTypeParameter, 2)) {
            console.error("Error defining generic types: convertFromTypeParameter "
               + "must be a function of two arguments taking in the index and the value "
               + "to be converted.");
            return undefined;
         }

         if (implementation.canConvertFromTypeParameter === undefined) {
            // If the user didn't define a restriction function for conversion, define
            // a basic one ourselves.
            implementation.canConvertFromTypeParameter = function(index) {
               return index < this.typeParameters.length;
            }
         }
         else if (!_isFunctionOfNArguments(implementation.canConvertFromTypeParameter, 1)) {
            // If they did, though, validate it.
            console.error("Error defining generic types: canConvertFromTypeParameter "
               + "must be a function of one argument taking in only the index.");
            return undefined;
         }
      }
      else {
         // If they didn't define a conversion function, make sure canConvert... always is false.
         implementation.canConvertFromTypeParameter = function(index) {
            return false;
         }
      }

      if (implementation.convertToType !== undefined) {
         if(!_isFunctionOfNArguments(implementation.convertToType, 1)) {
            console.error("Error defining generic type: convertToType must be a function of "
               + "one argument taking in the type to be converted to.");
            return undefined;
         }

         if (!_isFunctionOfNArguments(implementation.canConvertToType, 1)) {
            console.error("Error defining generic type: If convertToType is defined, "
               + "canConvertToType must also be defined as a function of one argument taking "
               + "in the type to be converted to.");
            return undefined;
         }
      }

      if (implementation.convertFromType !== undefined) {
         if(!_isFunctionOfNArguments(implementation.convertFromType, 1)) {
            console.error("Error defining generic type: convertFromType must be a function of "
               + "one argument taking in the value to be converted.");
            return undefined;
         }

         if (!_isFunctionOfNArguments(implementation.canConvertFromType, 1)) {
            console.error("Error defining generic type: If convertFromType is defined, "
               + "canConvertFromType must also be defined as a function of one argument taking "
               + "in the type to be converted from.");
            return undefined;
         }
      }

      function createType() {
         // This function will return a concrete implementation of the generic type,
         // with concrete type parameters.
         let typename = '$' + implementation.typename + '_$';
         let typeParameters = [];
         for (let i = 0; i < arguments.length; i++) {
            if (!AT.typeIsDefined(arguments[i])) {
               console.error('Attempted to construct a generic ' + implementation.typename
                  + ' with a type parameter that is not a type.');
               return undefined;
            }
            typename += arguments[i].name + '$';
            typeParameters.push(arguments[i]);
         }
         typename += '_';

         if (AT.typeIsDefined(typename)) {
            // Already defined, just return it.
            return AT.typeNamed(typename);
         }
         else {
            // First, define the type itself
            let concreteImplementation = {
               typename: typename,
               genericType: GenericType,
               init: implementation.init,
               typeParameters: typeParameters,
            };
            for (let property in implementation) {
               if (concreteImplementation.hasOwnProperty(property)) { continue; }
               concreteImplementation[property] = implementation[property];
            }

            let type = AT.defineType(concreteImplementation);

            // Define conversions between this type and its type parameters where possible
            
            if (implementation.convertToTypeParameter !== undefined) {
               for (let i = 0; i < typeParameters.length; i++) {
                  if (type.prototype.canConvertToTypeParameter(i)) {
                     AT.defineConversion(type, typeParameters[i], function(genericValue) {
                        return genericValue.convertToTypeParameter(i);
                     });
                  }
               }
            }

            if (implementation.convertFromTypeParameter !== undefined) {
               for (let i = 0; i < typeParameters.length; i++) {
                  if (type.prototype.canConvertFromTypeParameter(i)) {
                     AT.defineConversion(typeParameters[i], type, function(parameterValue) {
                        return type.prototype.convertFromTypeParameter(i, parameterValue);
                     });
                  }
               }
            }

            return type;
         }
      }

      // As with when we define regular types, we use eval here to ensure that the Generic
      // type's function name is the same as its actual typename.
      let GenericType = eval("(function() {\n" +
            "return function " + implementation.typename + "() {\n" +
               "return createType.apply(null, arguments);\n" +
            "};\n" +
         "})();");

      _genericTypes[implementation.typename] = GenericType;

      AT[implementation.typename] = GenericType;

      return GenericType;
   };

   // Adds a conversion function to the global list of conversion functions, enabling it to
   // be used with Atypical.Type.convert.
   // If called multiple times with the same types, each call overrides the previous
   // conversion function.
   //
   // sourceType: The name or constructor of the type you're converting from. Must be a type
   //             that's already been defined.
   // destinationType: The name or constructor of the type you're converting to. Must be a type
   //                  that's already been defined.
   // conversionFunction: A function, taking in one argument of the source type, that returns
   //                     a value of the destination type, to be used for conversion.
   AT.defineConversion = function(sourceType, destinationType, conversionFunction) {
      let sourceTypename = _typename(sourceType);
      let destinationTypename = _typename(destinationType);
      if (!( typeof sourceTypename === "string" 
         && typeof destinationTypename === "string"
         && typeof conversionFunction === "function"))
      {
         console.error("Error adding type conversion, incorrect arguments.");
         return;
      }
      if (conversionFunction.length !== 1) {
         console.error("Error adding type conversion, conversion function must be of exactly "
            + "one argument.");
         return;
      }
      if (!_types.hasOwnProperty(sourceTypename)) {
         console.error("Error adding type conversion, source type "
            + sourceTypename + " not defined.");
         return;
      }
      if (!_types.hasOwnProperty(destinationTypename)) {
         console.error("Error adding type conversion, destination type "
            + destinationTypename + " not defined.");
         return;
      }

      _conversions[sourceTypename][destinationTypename] = conversionFunction;
   };

   // This function allows you to define a conversion between any two types S and D by using
   // type T as an intermediary. That is, when converting S to D, you first convert S to T and
   // then T to D.
   //
   // The arguments correspond to the types as so:
   //
   // sourceType: The name or constructor of the S type as described above, that you'd like to
   //             convert from. Must be a type that has already been defined.
   // intermediaryType: The name or constructor of the T type as described above. Must be a type
   //                   that has already been defined.
   // destinationType: The name or constructor of the D type as described above, that you'd like
   //                  to convert to. Must be a type that has already been defined.
   //
   // This function can be used one of three ways:
   //
   // 1. Defining all of S, T, and D. This adds a single conversion function, S -> D,
   //    by converting S -> T -> D, and requires that conversion functions for S -> T and T -> D
   //    already exist.
   //
   // 2. Defining S and T, but leaving D null. This defines a set of conversion functions S -> D
   //    for EVERY type D that's currently defined and for which a conversion function T -> D exists.
   //
   // 3. Defining T and D, but leaving S null. This defines a set of conversions S -> D for EVERY
   //    type S that's currently defined and for which a conversion S -> T exists.
   //
   // Note that these must be null, not undefined or any other falsy value.
   //
   // If you have already specified a conversion between S and D, this function will overwrite
   // this previously-specified conversion. As such, it's best to call this before defining any
   // special-case custom conversion functions.
   //
   // These intermediary conversions will also attempt to update to reflect any new conversions
   // that are added. E.g. if you set a conversion S -> T -> D for all D, and then define a new
   // type Q, and a new conversion for T -> Q, then the Atypical system will create S -> Q via
   // S -> T -> Q unless a previous S -> Q conversion was already defined.
   AT.defineConversionsViaIntermediary = function(
      sourceType, intermediaryType, destinationType)
   {
      let sourceTypename = _typename(sourceType);
      let intermediaryTypename = _typename(intermediaryType);
      let destinationTypename = _typename(destinationType);
      // Whole bunch of error checking, thanks Javascript.
      if (typeof intermediaryTypename !== "string") {
         console.error("Error defining conversion via intermediary, invalid intermediary type.");
      }
      if (!_types.hasOwnProperty(intermediaryTypename)) {
         console.error("Error defining conversion via intermediary, intermediary type "
            + intermediaryTypename + " not defined.");
         return;
      }
      if (intermediaryTypename === destinationTypename) {
         console.error("Error defining conversion via intermediary, destination type and "
            + "intermediary type are identical (" + intermediaryTypename + ")");
         return;
      }
      if (intermediaryTypename === sourceTypename) {
         console.error("Error defining conversion via intermediary, source type and "
            + "intermediary type are identical (" + intermediaryTypename + ")");
         return;
      }
      if (destinationTypename === null && sourceTypename === null) {
         console.error("Error defining conversion via intermediary, source type and destination "
            + "type cannot both be null.")
      }
      if (destinationTypename === sourceTypename) {
         console.error("Error defining conversion via intermediary, source type and "
            + "destination type are identical (" + sourceTypename + ")");
         return;
      }
      
      if (sourceTypename === null) {
         // Define S -> T -> D for all S.
         if (typeof destinationTypename !== "string") {
            console.error("Error defining conversion via intermediary, destination typename must "
               + "be a string or constructor function when sourceTypename is null.");
         }
         if (!_types.hasOwnProperty(destinationTypename)) {
            console.error("Error defining conversion via intermediary, destination type "
               + destinationTypename + " not defined.");
            return;
         }

         let conversionToDestination = _conversionFunction(
            intermediaryTypename, destinationTypename);

         if (!conversionToDestination) {
            console.error("Attempted to set " + intermediaryTypename + " as an intermediary for "
               + "conversions to " + destinationTypename
               + ", but no conversion between the two types exists.");
            return;
         }

         // Just note that this intermediary conversion has been established.
         // The _conversionFunction function will handle actually building the conversion
         // function.
         _intermediaryConversionsFromAnySource[destinationTypename].push(intermediaryTypename);
      }
      else if (destinationTypename === null) {
         // Define S -> T -> D for all D.
         if (typeof sourceTypename !== "string") {
            console.error("Error defining conversion via intermediary, source typename must "
               + "be a string or constructor function when destinationTypename is null.");
         }
         if (!_types.hasOwnProperty(sourceTypename)) {
            console.error("Error defining conversion via intermediary, source type "
               + sourceTypename + " not defined.");
            return;
         }

         let conversionToIntermediary = _conversionFunction(
            sourceTypename, intermediaryTypename);

         if (!conversionToIntermediary) {
            console.error("Attempted to set " + intermediaryTypename + " as an intermediary for "
               + "conversions from " + sourceTypename
               + ", but no conversion between the two types exists.");
            return;
         }

         // Just note that this intermediary conversion has been established.
         // The _conversionFunction function will handle actually building the conversion
         // function.
         _intermediaryConversionsToAnyDestination[sourceTypename].push(intermediaryTypename);
      }
      else {
         // Define S -> T -> D for specifc S and D.
         if (typeof sourceTypename !== "string") {
            console.error("Error defining conversion via intermediary, source typename must "
               + "be a string, constructor, or null.");
         }
         if (!_types.hasOwnProperty(sourceTypename)) {
            console.error("Error defining conversion via intermediary, source type "
               + sourceTypename + " not defined.");
            return;
         }
         if (typeof destinationTypename !== "string") {
            console.error("Error defining conversion via intermediary, destination typename must "
               + "be a string, constructor, or null.");
         }
         if (!_types.hasOwnProperty(destinationTypename)) {
            console.error("Error defining conversion via intermediary, destination type "
               + destinationTypename + " not defined.");
            return;
         }

         let conversionToIntermediary = _conversionFunction(
            sourceTypename, intermediaryTypename);

         if (!conversionToIntermediary) {
            console.error("Attempted to set " + intermediaryTypename + " as an intermediary for "
               + "conversions from " + sourceTypename + " to " + destinationTypename
               + ", but no conversion between " + sourceTypename + " and "
               + intermediaryTypename + " exists.");
            return;
         }

         let conversionToDestination = _conversionFunction(
            intermediaryTypename, destinationTypename);

         if (!conversionToDestination) {
            console.error("Attempted to set " + intermediaryTypename + " as an intermediary for "
               + "conversions from " + sourceTypename + " to " + destinationTypename
               + ", but no conversion between " + intermediaryTypename + " and "
               + destinationTypename + " exists.");
            return;
         }

         // This one is equivalent to an explicit conversion definition, so we modify
         // the _conversions map directly.
         _conversions[sourceTypename][destinationTypename] = function(value) {
            return conversionToDestination(conversionToIntermediary(value));
         }
      }
   };

   // Most users can ignore this function. It's used to create a new, "fresh" version of the
   // Atypical module with only the type definitions in this file. This is useful in unit testing
   // Atypical, as it allows you to create a version of the module without any additional type
   // and conversion definitions.
   AT._createTestingModule = AtypicalModuleGenerator;

   // Construction error. Meant to be thrown in a type's constructor if the type was instantiated
   // with incorrect arguments.
   AT.ConstructionError = function(message) { this.init(message); };
   AT.ConstructionError.prototype = {
      init: function(message) {
         this.name = "ConstructionError";
         this.message = (message || "Type was constructed with incorrect arguments");
      }
   };

   // Type definitions start here.

   AT.defineType({
      typename: "String",
      init: function(s) {
         if (s instanceof AT.String) { s = s.value; }
         this._set("value", "" + s);
      },
      toPrimitive: function() {
         return this.value;
      }
   });

   AT.defineType({
      typename: "Float",
      init: function(value) {
         if (value === undefined) { value = 0; }
         if (value instanceof AT.Float) { value = value.value; }
         else if (value instanceof Number) { value = value.valueOf(); }

         if (isNaN(value)) {
            throw new AT.ConstructionError("Float constructed with non-numerical input ("
               +value+")");
         }
         this._set("value", value);
      },
      toPrimitive: function() {
         return this.value;
      }
   });
   AT.defineConversion(AT.Float, AT.String, function(f) {
      return new AT.String("" + f.value.toFixed(3));
   });
   AT.defineConversion(AT.String, AT.Float, function(str) {
      var num = parseFloat(str.value);
      if (isNaN(num)) {
         return new AT.Float(0);
      }
      else {
         return new AT.Float(num);
      }
   });

   AT.defineType({
      typename: "Vector",
      init: function(value) {
         if (typeof(value) === "object" && value._quickConstruct != undefined) {
            // This is another option for construction. Pass in an object with "quickconstruct"
            // set to a well-formed array of floats, and this will construct it by just a simple
            // pointer copy with no validation performed at all.
            // This is more meant for internal use and is not recommended unless performance is
            // critical!
            this._set("values", value._quickConstruct);
            return;
         }

         if (value instanceof Array) {
            var values = value;
         }
         else {
            var values = Array.from(arguments);
         }

         for (let i = 0; i < values.length; i++) {
            if (values[i] instanceof AT.Float) {
               values[i] = values[i].value;
            }
            else {
               // AT.Float will take care of validating our arguments.
               values[i] = (new AT.Float(values[i])).value;
            }
         }
         this._set("values", values);
      },
      magnitude: function() {
         let squares = this.values.map(function(x) { return x*x; });
         let sum = squares.reduce(function(acc, val) { return acc + val; }, 0);
         return sqrt(sum);
      },
      value: function(dimensionIndex) {
         return this.values[dimensionIndex] || 0;
      },
      x: function() {
         return this.value(0);
      },
      y: function() {
         return this.value(1);
      },
      z: function() {
         return this.value(2);
      },
      w: function() {
         return this.value(3);
      },
      dim: function() {
         return this.values.length;
      },
      length: function() {
         return this.dim();
      }
      // TODO: dot and cross products, other convenience functions
   });
   AT.defineConversion(AT.Vector, AT.Float, function(vec) {
      return new AT.Float(vec.magnitude());
   });
   AT.defineConversion(AT.Float, AT.Vector, function(r) {
      return new AT.Vector(r.value);
   });
   AT.defineConversion(AT.Vector, AT.String, function(v) {
      return this.values.reduce(function(acc, val) {
         if (acc.length === 1) {
            return acc + val;
         } else {
            return acc + ", " + val;
         }
      }, "(") + ")";
   });
   AT.defineConversion(AT.String, AT.Vector, function(str) {
      let numbers = str.value.split(/[^\d\.\+-eE]/).map(parseFloat).filter(
         function(value) { return !isNaN(value); }
      );
      return new AT.Vector(numbers);
   });


   AT.defineType({
      typename: "Matrix",
      init: function(rowsOrInit, columns) {
         let values = [];
         if (rowsOrInit instanceof AT.Matrix) {
            // Init from another matrix object
            values = rowsOrInit.values;
         }
         else if (typeof(rowsOrInit) === "object" && rowsOrInit._quickConstruct != undefined) {
            // This is another option for construction. Pass in an object with "quickconstruct"
            // set to a well-formed array of arrays of floats with every "row" of the matrix
            // being the same length, and this will construct it by just a simple pointer copy
            // with no validation performed at all.
            // This is more meant for internal use and is not recommended unless performance is
            // critical!
            values = rowsOrInit._quickConstruct;
         }
         else if (typeof(rowsOrInit) === "number" && typeof(columns) === "number") {
            // Init from size of rows and columns
            values = new Array(rowsOrInit);
            for (let row = 0; row < rowsOrInit; row++) {
               values[row] = new Array(columns).fill(0);
            }
         }
         else if (rowsOrInit instanceof Array) {
            if (!(rowsOrInit.length === 0 || rowsOrInit[0] instanceof Array)) {
               // If it's a 1D array, convert it to a 2D array first
               rowsOrInit = rowsOrInit.map(function(x) { return [x]; });
            }

            // Init from a 2D array of numbers
            let columns = rowsOrInit.reduce(function(max, row) {
               return Math.max(max, row.length);
            }, 0);
            values = new Array(rowsOrInit.length);
            for (let row = 0; row < rowsOrInit.length; row++) {
               values[row] = new Array(columns).fill(0);
               for (let column = 0; column < rowsOrInit[row].length; column++) {
                  // Convert via AT.Float for validation purposes
                  values[row][column] = new AT.Float(rowsOrInit[row][column]).value;
               }
            }
         }
         this.values = values.slice();
      },
      numRows: function() {
         return this.values.length;
      },
      numColumns: function() {
         return this.values[0] === undefined ? 0 : this.values[0].length;
      },
      dimensions: function() {
         return [this.numRows(), this.numColumns()];
      },
      element: function(row, column) {
         if (row >= this.values.length || column >= this.values[row].length) {
            return 0;
         }
         return this.values[row][column];
      },
      setElement: function(row, column, value) {
         if (row >= this.numRows() || column >= this.numColumns()) {
            console.error("Attempted to set element (" + row + ", " + column + ") of a(n) "
               + this.numRows() + "x" + this.numColumns() + " matrix");
            return;
         }
         this.values[row][column] = value;
      },
      copy: function() {
         return new AT.Matrix(this);
      },
      canMultiply: function(other) {
         if (other instanceof AT.Float || typeof(other) === "number") {
            return true;
         }
         else if (other instanceof AT.Matrix) {
            return this.numColumns() === other.numRows();
         }
         else {
            return false;
         }
      },
      times: function(other) {
         if (other instanceof AT.Float) {
            other = other.value;
         }
         if (typeof(other) === "number") {
            // Multiply by a constant
            return new AT.Matrix({_quickConstruct:
               this.values.map(function(row) {
                  return row.map(function(element) {
                     return element * other;
                  });
               })
            });
         }

         // Multiply by another matrix
         if (!(other instanceof AT.Matrix)) {
            console.error("Attempted to multiply a matrix by a non-matrix object " + other);
            return undefined;
         }
         else if (this.numColumns() !== other.numRows()) {
            console.error("Attempted to multiply matrices with incompatible dimensions, "
               + this.dimensions() + " times " + other.dimensions());
            return undefined;
         }
         
         let result = new Array(this.numRows());
         for (let i = 0; i < this.numRows(); i++) {
            result[i] = new Array(other.numColumns());
            for (let j = 0; j < other.numColumns(); j++) {
               let element = 0;
               for (let k = 0; k < this.numColumns(); k++) {
                  element += this.element(i, k) * other.element(k, j);
               }
               result[i][j] = element;
            }
         }
         return new AT.Matrix({_quickConstruct: result});
      },
      transpose: function() {
         let newValues = new Array(this.numColumns());
         for (let row = 0; row < this.numColumns(); row++) {
            newValues[row] = new Array(this.numRows());
            for (let column = 0; column < this.numRows(); column++) {
               newValues[row][column] = this.element(column, row);
            }
         }
         return new AT.Matrix({_quickConstruct: newValues});
      },
      toFlatArray: function() {
         // The rest of chalktalk keeps its array in column-major order
         let flatArray = new Array(this.numColumns() * this.numRows());
         for (let column = 0; column < this.numColumns(); column++) {
            for (let row = 0; row < this.numRows(); row++) {
               flatArray[column * this.numRows() + row] = this.element(row, column);
            }
         }
         return flatArray;
      }
   });

   AT.defineConversion(AT.Matrix, AT.String, function(mx) {
      let outputString = "[";
      for (let row = 0; row < mx.numRows(); row++) {
         outputString += (row === 0) ? "[" : "\n [";
         for (let col = 0; col < mx.numColumns(); col++) {
            if (col !== 0) { outputString += ", "; }
            outputString += mx.element(row, col).toFixed(3);
         }
         outputString += "]";
      }
      outputString += "]";
      return new AT.String(outputString);
   });



   AT.defineType({
      typename: "Int",
      init: function(value) {
         if (value === undefined) { value = 0; }
         else if (value instanceof AT.Int) { value = value.value; }
         else if (value instanceof Number) { value = value.valueOf(); }

         if (isNaN(value)) {
            throw new AT.ConstructionError("Int constructed with non-numerical input ("+value+")");
         }
         this._set("value", Math.round(value));
      },
      toPrimitive: function() {
         return this.value;
      }
   });
   AT.defineConversion(AT.Float, AT.Int, function(num) {
      try {
         return new AT.Int(num.value);
      }
      catch (error) {
         if (error instanceof AT.ConstructionError) {
            return undefined;
         }
         else {
            throw error;
         }
      }
   });
   AT.defineConversion(AT.Int, AT.Float, function(i) {
      return new AT.Float(i.value);
   });
   AT.defineConversionsViaIntermediary(null, AT.Float, AT.Int);
   AT.defineConversionsViaIntermediary(AT.Int, AT.Float, null);
   // Define a custom conversion to string. The float intermediary already gives us conversion
   // from string for free, but we want our ints to print without decimal places.
   AT.defineConversion(AT.Int, AT.String, function(i) {
      return new AT.String("" + i.value)
   });
   

   AT.defineType({
      typename: "Bool",
      init: function(value) {
         this._set("value", !!value);
      },
      toPrimitive: function() {
         return this.value;
      },
      not: function() {
         return new AT.Bool(!this.value);
      },
      and: function(other) {
         return new AT.Bool(this.value && other.value);
      },
      or: function(other) {
         return new AT.Bool(this.value || other.value);
      },
      xor: function(other) {
         return new AT.Bool(this.value !== other.value);
      }
   });
   AT.defineConversion(AT.Bool, AT.String, function(b) {
      return new AT.String(b.value ? "true" : "false");
   });
   AT.defineConversion(AT.String, AT.Bool, function(str) {
      var lower = str.value.toLowerCase();
      return new AT.Bool(lower !== "false" && lower !== "0" && lower !== "f");
   });
   AT.defineConversion(AT.Int, AT.Bool, function(i) {
      return new AT.Bool(i.value);
   });
   AT.defineConversion(AT.Float, AT.Bool, function(num) {
      return new AT.Bool(Math.abs(num.value) > 0.001);
   });
   AT.defineConversion(AT.Vector, AT.Bool, function(v) {
      let notZero = (v.magnitude() > 0.001);
      return new AT.Bool(notZero);
   });
   AT.defineConversion(AT.Bool, AT.Int, function(b) {
      return new AT.Int(b.value ? 1 : 0);
   });
   AT.defineConversion(AT.Bool, AT.Float, function(b) {
      return new AT.Float(b.value ? 1 : 0);
   });
   AT.defineConversion(AT.Bool, AT.Vector, function(b) {
      return new AT.Vector(b.value ? 1 : 0);
   });


   AT.defineGenericType({
      typename: "Array",
      // TODO: possible utility functions
      // set(index, value) function
      // init(length) function, which inits empty objects
      init: function() {
         let values = null;
         if (arguments.length === 1 && arguments[0] instanceof Array) {
            values = arguments[0];
         }
         else {
            values = Array.from(arguments);
         }

         for (let i = 0; i < values.length; i++) {
            if (!(values[i] instanceof this.typeParameters[0])) {
               values[i] = new (this.typeParameters[0])(values[i]);
            }
         }
         this._set("values", values);
      },
      toPrimitive: function() {
         return this.values.map(function (value) {
            if (value.isPrimitive()) {
               return value.toPrimitive();
            }
            else {
               return value;
            }
         });
      },
      canConvertToTypeParameter:  function(index) {
         return index === 0;
      },
      canConvertFromTypeParameter: function(index) {
         return index === 0;
      },
      convertToTypeParameter: function(index) {
         return this.values[0] !== undefined ? this.values[0] : new (this.typeParameters[0])();
      },
      convertFromTypeParameter: function(index, value) {
         return new this.type([value]);
      },
      changeTypeParameters: function(newTypeParams) {
         return new (this.genericType(newTypeParams[0]))(
            this.values.map(function(value) {
               return value.convert(newTypeParams[0]);
            }
         ));
      },

      get: function(index) {
         return this.values[index];
      },
      length: function() {
         return this.values.length;
      }
   });
   // Define a few specific conversions for specific subtypes
   AT.defineConversion(AT.Vector, AT.Array(AT.Float), function (vec3) {
      return new (AT.Array(AT.Float))(vec3.values);
   });
   AT.defineConversion(AT.Array(AT.Float), AT.Vector, function(arr) {
      return new AT.Vector(arr.values);
   });
   // TODO: is it possible to make the last argument there just any AT.Array with a float-compatible type?
   AT.defineConversionsViaIntermediary(AT.Vector, AT.Array(AT.Float), AT.Array(AT.Int));
   // TODO: same for the first argument here
   AT.defineConversionsViaIntermediary(AT.Array(AT.Int), AT.Array(AT.Float), AT.Vector);

   // TODO: WISH LIST FOR ARRAYS:
   // Ability to define intermediary Vector -> Array(Float) -> Array(T) for any Float -> T, e.g.
   // AT.defineConversionsViaIntermediary(AT.Vector, AT.Array(AT.Float), AT.Array);
   // Ability to define conversion Array(T) -> String for any T -> String
   // AT.defineConversion(AT.Array, AT.String, function(arr) {
   //    // Pass each value through String conversion, intersperse commas and surround with []
   // },
   // function(typeParameters) {
   //    return typeParameters[0].canConvert(AT.String);
   // });

   // Void type, mostly a convenient placeholder type for use in Function type parameters.
   AT.defineType({
      typename: "Void",
      init: function() {
         throw new AT.ConstructionError("Attempted to construct a Void object.");
      }
   });

   // Type representing a function or closure.
   // The last type parameter is the return type of the function (can be AT.Void if the function
   // returns nothing).
   // All other type parameters are the types of the arguments to the functions.
   //
   // For example, AT.Function(AT.Int, AT.String) is the type of a function that takes in an
   // Int and returns a String, whereas AT.Function(AT.Float, AT.Float, AT.Void) takes in two
   // Float arguments and returns nothing.
   //
   // For types that are primitives, such as Float, Int, and String, the function used to
   // construct this AT.Function object should both return and assume that it'll be receiving
   // unwrapped primitive arguments, such as regular Javascript numbers and strings.
   //
   // Once constructed, you can use function.call(...) to call the wrapped function directly,
   // or use function.callSafely(...) to call it while verifying the arguments' types.
   AT.defineGenericType({
      typename: "Function",
      init: function(func) {
         if (typeof func !== "function") {
            throw new AT.ConstructionError("Attempted to construct a Function with a(n) "
               + (typeof func) + " instead of a function");
         }
         if (this.typeParameters.length === 0) {
            throw new AT.ConstructionError("Attempted to construct a Function with no "
               + "type parameters. Use AT.Function(AT.Void) for functions that return "
               + "no values and take no arguments.");
         }
         this._set("func", func);
         this._set("call", func);
      },
      toPrimitive: function() {
         return this.call;
      },
      // Can convert from return value (makes it a constant function)
      canConvertFromTypeParameter: function(index) {
         return index === this.typeParameters.length - 1;
      },
      convertFromTypeParameter: function(index, value) {
         if (value.isPrimitive()) {
            return new this.type(function() {
               return value.toPrimitive();
            });
         }
         else {
            return new this.type(function() {
               return value;
            });
         }
      },
      changeTypeParameters: function(newTypes) {
         let sourceFunction = this;
         return new (this.genericType.apply(null, newTypes))(function() {
            let convertedArguments = [];
            for (let i = 0;
               i < Math.min(arguments.length, sourceFunction.typeParameters.length - 1); i++)
            {
               convertedArguments.push(
                  AT.wrapOrConvertValue(sourceFunction.typeParameters[i], arguments[i]));
            }

            let returnValue = sourceFunction.callWrapped.apply(
               sourceFunction, convertedArguments);

            return returnValue.convert(newTypes[newTypes.length - 1]);
         });
      },
      canChangeTypeParameters: function(newTypeParams) {
         // You can always convert a function of fewer arguments to a function of more
         // arguments so long as you have a compatible return value.
         // E.g. a Function(Int, String) can be converted to a Function(Int, Float, String)
         // by just ignoring the second argument.
         // The opposite is impossible, though.
         if (this.typeParameters.length > newTypeParams.length) {
            return false;
         }

         // When converting a function that takes in (A, B) and returns C to one that takes in
         // (X, Y) and returns Z, you need the return value to be convertible from the source
         // type to the destination type (i.e. C -> Z, as the internal function will return a
         // C), but the ARGUMENT types need to go in the opposite direction (i.e. X -> A
         // and Y -> B, because the arguments need to be converted in that direction in order
         // to be passed into the internal function.)

         if (!AT.canConvert(this.typeParameters[this.typeParameters.length - 1],
            newTypeParams[newTypeParams.length - 1]))
         {
            return false;
         }

         for (let i = 0;
            i < Math.min(this.typeParameters.length - 1, newTypeParams.length - 1);
            i++)
         {
            if (!AT.canConvert(newTypeParams[i], this.typeParameters[i])) {
               return false;
            }
         }
         return true;
      },
      // This calls the internal function with some type checking, making sure that the arguments
      // are wrapped or converted to the correct Atypical type (and then unwrapped, if they're
      // primitives), and that the return value is also the correct type (again, unwrapped if it's
      // a primitive).
      //
      // Throws AT.ConstructionError if an argument is passed that cannot be converted to the
      // correct type, or if the return value cannot be converted to the correct type.
      callSafely: function() {
         let returnValue = this.callWrapped.apply(this, arguments);
         // If it's a primitive, wrapping it and unwrapping it is the easiest way
         // to do type verification.
         if (returnValue !== undefined && returnValue.isPrimitive()) {
            return returnValue.toPrimitive();
         }
         else {
            return returnValue;
         }
      },
      // This calls the internal function with some type checking, making sure that the arguments
      // are wrapped or converted to the correct Atypical type (and then unwrapped, if they're
      // primitives), and that the return value is also the correct type. However, unlike
      // callSafely, this always returns a wrapped value, even for primitive types.
      //
      // Throws AT.ConstructionError if an argument is passed that cannot be converted to the
      // correct type, or if the return value cannot be converted to the correct type.
      callWrapped: function() {
         // Clean up arguments to make sure they're the right type (converting them to
         // primitive values where possible)
         for (let i = 0; i < Math.min(arguments.length, this.typeParameters.length - 1); i++) {
            let wrappedArg = AT.wrapOrConvertValue(this.typeParameters[i], arguments[i]);

            if (wrappedArg.isPrimitive()) {
               // If it's a primitive, wrapping it and unwrapping it is the easiest way
               // to do type verification.
               arguments[i] = wrappedArg.toPrimitive();
            }
            else {
               arguments[i] = wrappedArg;
            }
         }

         let returnValue = this.func.apply(this, arguments);

         let returnType = this.typeParameters[this.typeParameters.length - 1];

         if (returnType === AT.Void) {
            return undefined;
         }

         return AT.wrapOrConvertValue(returnType, returnValue);
      }
   });

   AT.defineGenericType({
      typename: "Pair",
      init: function(first, second) {
         this._set("first", AT.wrapOrConvertValue(this.typeParameters[0], first));
         this._set("second", AT.wrapOrConvertValue(this.typeParameters[1], second));
      },
      changeTypeParameters: function(newTypes) {
         return new (this.genericType.apply(null, newTypes))(this.first, this.second);
      },
      canConvertToTypeParameter: function(typeIndex) {
         return typeIndex === 0 || typeIndex === 1;
      },
      convertToTypeParameter: function(typeIndex) {
         if (typeIndex === 0) {
            return this.first;
         }
         else {
            return this.second;
         }
      }
   });

   // TODO: EXPLAIN WHAT THIS IS
   AT.defineGenericType({
      typename: "AnyOf",
      init: function(values) {
         let typedValues = [];
         if (values instanceof Array) {
            // Assume each element of the array exactly corresponds with each type parameter
            for (let i = 0; i < values.length && i < this.typeParameters.length; i++) {
               if (values[i] !== null && values[i] !== undefined) {
                  typedValues.push(AT.wrapOrConvertValue(this.typeParameters[i], values[i]));
               }
            }
         }
         else {
            // Assume it's an unstructured set of arguments that are ALREADY wrapped
            let checkType = function(value) {
               // Check for exact type matches
               for (let i = 0; i < this.typeParameters.length; i++) {
                  if (value instanceof this.typeParameters[i]) {
                     return value;
                  }
               }
               // If it doesn't match any of our types, give up!
               throw new AT.ConstructionError("Attempted to construct "
                  + AT.prettyTypename(this.type)
                  + " with incompatible or unwrapped value "
                  + value);
            }.bind(this);

            typedValues = Array.from(arguments).map(checkType);
         }

         let valuesObject = {};
         let rawValues = {};
         for (let i = 0; i < typedValues.length; i++) {
            let value = typedValues[i];
            if (value.isPrimitive()) {
               valuesObject[value.type.name] = value.toPrimitive();
            }
            else {
               valuesObject[value.type.name] = value;
            }
            rawValues[value.type.name] = value;
         }

         for (let i = 0; i < this.typeParameters.length; i++) {
            let type = this.typeParameters[i];
            if (type.name in valuesObject) {
               this._set(type.name, valuesObject[type.name]);
            }
            else {
               this._set(type.name, null);
               valuesObject[type.name] = null;
               rawValues[type.name] = null;
            }
         }
         this._set("values", valuesObject);
         this._set("rawValues", rawValues);
      },
      canChangeTypeParameters: function(newTypes) {
         // If there's any overlap between the types at all, allow the conversion
         for (let i = 0; i < newTypes.length; i++) {
            if (this.typeParameters.indexOf(newTypes[i]) >= 0) {
               return true;
            }
         }
      },
      changeTypeParameters: function(newTypes) {
         let newValues = []
         for (let typename in this.values) {
            let type = AT.typeNamed(typename);
            if (newTypes.indexOf(type) !== -1) {
               newValues.push(AT.wrapOrConvertValue(type, this.values[typename]));
            }
         }
         return new (this.genericType(...newTypes))(...newValues);
      },
      convertToTypeParameter: function(typeIndex) {
         let value = this.values[this.typeParameters[typeIndex].name];
         return value !== null
            ? AT.wrapOrConvertValue(this.typeParameters[typeIndex], value)
            : new (this.typeParameters[typeIndex])();
      },
      convertFromTypeParameter: function(typeIndex, value) {
         return new this.type(value);
      },
      canConvertFromType: function(type) {
         for (let i = 0; i < this.typeParameters.length; i++) {
            if (AT.canConvert(type, this.typeParameters[i])) {
               return true;
            }
         }
      },
      convertFromType: function(value) {
         for (let i = 0; i < this.typeParameters.length; i++) {
            if (value.canConvert(this.typeParameters[i])) {
               return new (this.type)(value.convert(this.typeParameters[i]));
            }
         }
         return undefined;
      }
   });

   return AT;
};

window.Atypical = AtypicalModuleGenerator();

// Convenience alias to make it easier to type.
window.AT = Atypical;

})();
