function() {
   this.label = 'bst';


   this.props = {
      isPaused : false,
      breakpointsOn : false,
      speedFactor : 1.0
   };

   function SketchGlyphCommand(name, src, commandCallback) {
      SketchGlyph.call(this, name, src);
      this.execute = commandCallback || function() {};
   }
   SketchGlyphCommand.Null = new SketchGlyphCommand(null, [], null);
   SketchGlyphCommand.compare = function(glyph) { return glyph.WORST_SCORE; },
   SketchGlyphCommand.execute = function(args) {};

   SketchGlyphCommand.compareAll = function(curves, glyphs, tolerance = 500) {
      const drawing = new SketchGlyph(null, curves);

      let best = {glyph : SketchGlyphCommand.Null, score : drawing.WORST_SCORE, idx : -1};
      
      //console.log("GLYPHS");
      //console.log(glyphs);
      //console.log("CURVES");
      //console.log(curves);
      
      for (let i = 0; i < glyphs.length; i++) {
         const score = drawing.compare(glyphs[i]);
         if (score < best.score) {
            //console.log("FOUND BETTER");
            best.glyphMatch = glyphs[i];
            best.score = score;
            best.idx = i;
         }
      }
      
      //console.log("BEST");
      //console.log(best);

      return best;
   };

   function CurveStore() {}
   CurveStore.prototype = {
      c : [],
      beginCurve : function() {
         this.c.push([]);   
      },
      addPoint : function(p) {
         this.c[this.c.length - 1].push(p);
      },
      begin : function() {
         this.c = [];
      },
      clear : function() {
         this.c = [];
      },
      get array() {
         return this.c;
      },
      get length() {
         return this.c.length;
      },
      get lastCurve() {
         return this.c[this.c.length - 1];
      },
      get lastPoint() {
         const numCurves = this.c.length;
         const numPoints = this.c[numCurves - 1].length;
         return this.c[numCurves - 1][numPoints - 1];
      },
   };


   this.setupTree = function() {
      this.tree = new BinarySearchTree(this);
      this.tree.root = this.tree.createBSTWithDepth(3);
      this.tree.saveState();
   };

   this.setupGlyphCommands = function() {
      this.cmdGlyphs = [
         new SketchGlyphCommand("pre-order", [
            [[0, 1], [-1, -1], [1, -1]]
         ], function(args) {
               args.self.tree.addOperation({
                  sketch : args.self,
                  proc : BinarySearchTree.prototype.preOrder,
                  self : args.self.tree, 
                  root : args.self.tree.root,
                  pauseDuration : args.self.tree.calcTraversalPauseTime(),
                  callback : null,
                  callbackArgs : null
               });
            }
         ),

         new SketchGlyphCommand("in-order", [
            [[-1, -1], [0, 1], [1, -1]]
         ], function(args) { 
               args.self.tree.addOperation({
                  sketch : args.self,
                  proc : BinarySearchTree.prototype.inOrder,
                  self : args.self.tree, 
                  root : args.self.tree.root,
                  pauseDuration : args.self.tree.calcTraversalPauseTime(),
                  callback : null,
                  callbackArgs : null
               });
            }
         ),

         new SketchGlyphCommand("post-order", [
            [[-1, -1], [1, -1], [0, 1]]
         ], function(args) { 
               args.self.tree.addOperation({
                  sketch : args.self,
                  proc : BinarySearchTree.prototype.postOrder,
                  self : args.self.tree, 
                  root : args.self.tree.root,
                  pauseDuration : args.self.tree.calcTraversalPauseTime(),
                  callback : null,
                  callbackArgs : null
               });
            }
         ),

         new SketchGlyphCommand("breadth-first", [
            [[0, 1], [-1, 0.75], [1, 0.75], [-1, 0], [1, 0]]
         ], function(args) { 
               args.self.tree.addOperation({
                  sketch : args.self,
                  proc : BinarySearchTree.prototype.breadthFirst,
                  self : args.self.tree, 
                  root : args.self.tree.root,
                  pauseDuration : args.self.tree.calcTraversalPauseTime(),
                  callback : null,
                  callbackArgs : null
               });
         }),
      ];      
   };


/*
   const bstSum = function*(args) {
         const sketch    = args.sketch;
         const self      = args.self;
         const node      = args.root;

         if (node == null) {
            return 0;
         }


         const pauseTime = args.pauseDuration;
         const proc      = args.proc;

         {
            node.colorManager.enableColor(true).setColor("purple");
            self.operationMemory.pause = LerpUtil.pause(pauseTime * (1 / sketch.prop('speedFactor')));
            yield;
         }

         args.root = node.left;
         const subLeft = (node.left == null) ? 0 : yield *proc(args);
         args.root = node.right;
         const subRight = (node.right == null) ? 0 : yield *proc(args);

         node.value += subLeft + subRight;

         {
            node.colorManager.enableColor(true).setColor("green");
            self.operationMemory.pause = LerpUtil.pause(pauseTime * (1 / sketch.prop('speedFactor')));
            yield;

            if (self.breakpoint.block()) {
               yield;
            }
         }
         
         return node.value;
      },

   this.cmdGlyphs.push(
         new SketchGlyphCommand("sum", [
            [[1, 1], [-1, 1], [0, 0], [-1, -1], [1, -1]]
         ], function(args) {
               args.self.tree.saveState();
               args.self.tree.addOperation({
                  sketch : args.self,
                  proc : bstSum,
                  self : args.self.tree, 
                  root : args.self.tree.root,
                  pauseDuration : args.self.tree.calcTraversalPauseTime(),
                  callback : null,
                  callbackArgs : null
               });
            }
         )
   );

*/

   this.setup = function() {
      //sketchCtx = this;
      this.setupTree();
      this.setupGlyphCommands();

      this.glyphCurves = new CurveStore();
      this.glyphCommandInProgress = false;

      this.isAcceptingInput = true;
   };

   this.initCopy = function() {
      //sketchCtx = this;
      const tree = this.tree;
      if (tree.historyStack.length == 0) {
         return;
      }
      if (tree.isAcceptingInput) {
         tree.historyStack = tree.historyStack.slice(tree.historyStack.length - 1);
      }
      else {
         // COPY THE TREE BEFORE AN OPERATION WAS IN PROGRESS
         tree.historyStack = tree.historyStack.slice(tree.historyStack.length - 2);
         const newBST = tree.historyStack[tree.historyStack.length - 1];
         tree.root = newBST.root;
         tree.isAcceptingInput = true;
         tree.operationMemory.active = false;
         tree.operationMemory.operation = null;
      }
      tree.resetTemporaryGraphics();
   };

   // STORE CLICK INFORMATION FROM PREVIOUS FRAMES
   this.clickInfoCache = {
      px : null,
      py : null,
      time : -1
   };


   this.onPress = function(p) {
      if (!this.sketchIsAcceptingInput()) {
         return;
      }

      const ci = this.clickInfoCache;
      ci.x = p.x;
      ci.y = p.y;
      ci.time = time;


      this.tree.resetTemporaryGraphics();
   }

   this.onRelease = function(p) {
      if (!this.sketchIsAcceptingInput()) {
         return;
      }

      const ci = this.clickInfoCache;
      if (abs(p.x - ci.x) < 0.05 &&
          abs(p.y - ci.y) < 0.05) {
         const node = this.tree.findClickedNode(this.tree.root, [ci.x, ci.y]);
         if (node !== null) {
            this.tree.saveState();
            this.tree.remove(node.value);
         }
      }
      ci.x = null;
      ci.y = null;
   }

   this.onSwipe[4] = [
      'undo',
      function() {
         this.tree.restorePast();
      }
   ];

   function unpause(entity) {
      if (!entity.breakpoint) {
         return;
      }

      entity.breakpoint.unblock();
   }

   this.onSwipe[0] = [
      'next',
      function() {
         if (!this.tree.isAcceptingInput) {
            unpause(this.tree);
         } else {
            // this.tree.breakpoint.enableBreakpoints(
            //    !this.tree.breakpoint.breakpointsAreActive
            // );
         }
      }
   ];



   this.onCmdPress = function(p) {
      if (this.glyphCommandInProgress) {
         return;
      }
      this.tree.resetTemporaryGraphics();
      this.glyphCommandInProgress = true;

      this.glyphCurves.beginCurve();
      this.onCmdDrag(p);
   };
   this.onCmdDrag = function(p) {
      if (!this.glyphCommandInProgress) {
         return;
      }

      this.glyphCurves.addPoint([p.x, p.y]);
   };

   // MORE ACCURATE? 
   this.mouseDown = function(x, y, z) {
      //console.log("MOUSEDOWN");
      //this.glyphCurves.beginCurve();
      //this.mouseDrag(x, y, z);
   }
   this.mouseDrag = function(x, y, z) {
      //console.log("MOUSEDRAG");
      // if (!this.glyphCommandInProgress) {
      //    return;
      // }
      //this.glyphCurves.addPoint(this.inverseTransform([x, y, z]));
   };
   this.mouseUp = function() {
      //console.log("MOUSEUP");
      //this.glyphCurves.clear();
   };
   //////////////////////////////////////
   this.onCmdRelease = function(p) {
      if (!this.glyphCommandInProgress) {
         return;
      }

      SketchGlyphCommand.compareAll(
         this.glyphCurves.array,
         this.cmdGlyphs
      ).glyphMatch.execute({self : this});

      this.glyphCurves.clear();
      this.glyphCommandInProgress = false;
   };

   this.onDrag = function(p) {
      if (!this.sketchIsAcceptingInput()) {
         return;
      }

      const ci = this.clickInfoCache;
      // SAVE A POINT "BOUNDARY/"THRESHOLD" FOR COMPARISON
      const point = [p.x, p.y];

      const addedDepth = Math.round((ci.y - point[1]) / 2);
      if (addedDepth !== 0) {
         let newDepth = this.tree.depth + addedDepth;
         newDepth = min(newDepth, 6);
         newDepth = max(newDepth, 0);
         this.tree.root = this.tree.createBSTWithDepth(newDepth);
         this.tree._mustInitializePositions = true;
         if (!(this.tree.depth === 0 && newDepth === 0)) {
            this.tree.saveState();
         }
         this.tree.depth = newDepth;

         ci.y = point[1];
      };
   };

   this.output = function() {
      //return this.tree.operationStack;
      return this.tree.recursiveCallStack;
   }

   this.under = function(other) {
      if (other.output === undefined) {
         return;
      }

      if (this.sketchIsAcceptingInput()) {
         if (other.label && other.label === "BST") {
            console.log("TODO: merge trees operation");
         }
         else {
            let out = other.output();
            out = Number(1 * out);

            if (isNaN(out)) {
               return;
            }

            this.tree.saveState();
            this.tree.insert(out);
         }
      }

      other.fade();
      other.delete();
   };


   this.sketchIsAcceptingInput = function() {
      return this.tree.isAcceptingInput;
   };

   this.breakpointsWereOn = false;
   // THE ELAPSED TIME MUST BE AVAILABLE AT ALL TIMES, HOW TO ENFORCE?
   this.render = function(elapsed) {
      this.duringSketch(function() {
         mCurve([
            // OUTER
            [-3.75, -2],
            [-2.5, -1],
            [0, 0],
            [2.5, -1],
            [3.75, -2],
         ]);
         mCurve([
            // INNER
            [3.75, -2],
            [1.25, -2],
            [2.5, -1]
         ]);
      });


      this.afterSketch(function() {

         do {
            const BREAKPOINTS_ON = this.prop("breakpointsOn");
            if (!BREAKPOINTS_ON && this.breakpointsWereOn) {
               unpause(this.tree);
            }

            this.breakpointsWereOn = BREAKPOINTS_ON;
            
            const IS_BLOCKED = this.prop("isPaused") || (this.tree.doPendingOperation(BREAKPOINTS_ON) == -1);

            this.tree.drawTree();

            if (IS_BLOCKED) {
               textHeight(this.mScale(0.8));
               mText("||", [0.0, 1.0], .5, .5, .5);
            }

         } while (this.prop("isImmediate") && this.tree.operationMemory.active);

            _g.save();
            color("cyan");
            lineWidth(1);
            const curves = this.glyphCurves.array;
            for (let i = 0; i < curves.length; i++) {
               mCurve(curves[i]);
            }
            _g.restore();

      });
   };

   // OPERATIONS: //////////////////////////////////////////////////////////////////
   BinarySearchTree.prototype = {
      PENDING_COLOR : "rgb(20, 65, 113)",
      doPendingOperation : function(useBreakpoints = false) {
         if (!this.operationMemory.active) {
            this.isAcceptingInput = true;
            return;
         }

         //console.log("BREAKPOINTSON: " + breakpointsOn);
        // console.log("BLOCKED ENABLED: " + useBreakpoints + ", IS BLOCKED: " + this.breakpoint.isBlocked());
         if (useBreakpoints && this.breakpoint.isBlocked()) {
            return -1;
         }

         if (this.operationMemory.pause) {
            if (this.operationMemory.pause()) {
               return;
            }
            else {
               this.operationMemory.pause = null;
            }
         }

         const status = this.operationMemory.operation();
         if (status.done) {
            this.operationMemory.active = false;
            this.operationMemory.operation = null;
            this.operationMemory.pause = null;
            // TODO : MAKE RE-INITIALIZATION CLEANER,
            // ADDITIONAL CASES TO CONSIDER FOR IN-PROGRESS OPERATIONS
            this._mustInitializePositions = true;
            this.isAcceptingInput = true;

            this.breakpoint.unblock();

            return;
         }
         this.isAcceptingInput = false;
         return;
      },
      hasPendingOperation : function() {
         return this.operationMemory.active;
      },

      doPendingDraws : function() {
         // TODO
      },

      mustInitializePositions : function() {
         return this._mustInitializePositions;
      },
      // TODO IMPROVE
      calcTraversalPauseTime : function() {
         const size = this.size();
         if (size == 0) {
            return 0.1 / 1.5;
         }
         const ret = max((4.2 / size), 0.13);
         return ret / 1.5;
      },

      getSize: function(){
        return this._getSize(this.root);
      },

      _getSize : function(node) {
         if (node === null) {
            return 0;
         }
         return this._getSize(node.left) + 1 + this._getSize(node.right);
      },

      addOperation : function(args) {
         const self = this;
         if (!this.operationMemory.active) {
            this.operationMemory.operation = (function() {
               const op = args.proc(args);

               let retVal = null;

               return function() {
                  const out = op.next(retVal);
                  retVal = out.value;
                  return out;
               };

            }());
            this.operationMemory.active = true;
         }
      },

      inOrder : function*(args) {
         const sketch    = args.sketch;
         const self      = args.self;
         const node      = args.root;
         const pauseTime = args.pauseDuration;
         const proc      = args.proc;

         if (node == null) {
            return;
         }

         const stackRecord = {value : node.value, color : "purple", time : time};
         {
               node.colorManager.enableColor(true).setColor("purple");
               
               self.recursiveCallStack.push(stackRecord);

               self.operationMemory.pause = LerpUtil.pause(pauseTime * (1 / sketch.prop('speedFactor')));
               yield;
         }

         if (node.left != null) {
            args.root = node.left;
            yield *proc(args);
         }

         {
               node.colorManager.enableColor(true).setColor("green");
               stackRecord.color = "green";

               self.operationMemory.pause = LerpUtil.pause(pauseTime * (1 / sketch.prop('speedFactor')));
               yield;

               if (self.breakpoint.block()) {
                  yield;
               }
         }

         if (node.right != null) {
            args.root = node.right;
            yield *proc(args);
         }


         {
               node.colorManager.enableColor(true).setColor("red");
               stackRecord.color = "red";

               self.operationMemory.pause = LerpUtil.pause(pauseTime * (1 / sketch.prop('speedFactor')));
               yield;

               self.recursiveCallStack.pop();

               self.operationMemory.pause = LerpUtil.pause(pauseTime * (1 / sketch.prop('speedFactor')));
               yield;
         }
      },

      preOrder : function*(args) {
         const sketch    = args.sketch;
         const self      = args.self;
         const node      = args.root;
         const pauseTime = args.pauseDuration;
         const proc      = args.proc;

         if (node == null) {
            return;
         }

               const stackRecord = {value : node.value, color : "green", time : time};
               {
                  node.colorManager.enableColor(true).setColor("green");

                  self.recursiveCallStack.push(stackRecord);

                  self.operationMemory.pause = LerpUtil.pause(pauseTime * (1 / sketch.prop('speedFactor')));
                  yield;
               }

         if (node.left != null) {
            args.root = node.left;
            yield *proc(args);
         }

               if (self.breakpoint.block()) {
                  yield;
               }

         if (node.right != null) {
            args.root = node.right;
            yield *proc(args);
         }


               {
                     node.colorManager.enableColor(true).setColor("green");
                     stackRecord.color = "green";

                     self.operationMemory.pause = LerpUtil.pause(pauseTime * (1 / sketch.prop('speedFactor')));
                     yield;

                     if (self.breakpoint.block()) {
                        yield;
                     }
               }
               {
                  node.colorManager.enableColor(true).setColor("red");
                  stackRecord.color = "red";

                  self.operationMemory.pause = LerpUtil.pause(pauseTime * (1 / sketch.prop('speedFactor')));
                  yield;

                  self.recursiveCallStack.pop();

                  self.operationMemory.pause = LerpUtil.pause(pauseTime * (1 / sketch.prop('speedFactor')));
                  yield;
               }
      },

      postOrder: function*(args) {
         const sketch    = args.sketch;
         const self      = args.self;
         const node      = args.root;
         const pauseTime = args.pauseDuration;
         const proc      = args.proc;

         if (node == null) {
            return;
         }

               const stackRecord = {value : node.value, color : "purple", time : time};
               {
                  node.colorManager.enableColor(true).setColor("purple");

                  self.recursiveCallStack.push(stackRecord);

                  self.operationMemory.pause = LerpUtil.pause(pauseTime * (1 / sketch.prop('speedFactor')));
                  yield;
               }

         if (node.left  != null) {
            args.root = node.left;
            yield *proc(args);
         }

         if (node.right != null) {
            args.root = node.right;
            yield *proc(args);
         }
               {

                  self.operationMemory.pause = LerpUtil.pause(pauseTime * (1 / sketch.prop('speedFactor')));
                  yield;
                  node.colorManager.enableColor(true).setColor("green");
                  stackRecord.color = "green";
                  if (self.breakpoint.block()) {
                     yield;
                  }
               }

               {
                  node.colorManager.enableColor(true).setColor("red");
                  stackRecord.color = "red";

                  self.operationMemory.pause = LerpUtil.pause(pauseTime * (1 / sketch.prop('speedFactor')));
                  yield;

                  self.recursiveCallStack.pop();

                  self.operationMemory.pause = LerpUtil.pause(pauseTime * (1 / sketch.prop('speedFactor')));
                  yield;
               }
      },
      breadthFirst : function*(args) {
         if (args.root === null) {
            return;
         }

         const pauseDuration = args.pauseDuration || 0;

         const pauseDequeue = LerpUtil.pauseAutoReset(pauseDuration);
         const pauseEnqueue = LerpUtil.pauseAutoReset(pauseDuration);

         const queue = [];
         let parent = args.root;
         const self = args.self;

         parent.colorManager.enableColor(true).setColor(self.PENDING_COLOR);
         queue.push(parent);
         args.self.recursiveCallStack.push({value : parent.value, color : self.PENDING_COLOR, time : time});


         while (pauseEnqueue()) { yield; }
         if (self.breakpoint.block()) {
            yield;
         }
         
         while (queue.length > 0) {
            parent = queue.shift();
            //parent = queue.pop();
            parent.colorManager.enableColor(true).setColor("green");

            args.self.recursiveCallStack[0].color = "green";

            while (pauseDequeue()) { yield; }

            if (self.breakpoint.block()) {
               yield;
            }

            args.self.recursiveCallStack.shift();

            //console.log(parent.children);

            for (const child of parent.children) {
               child.colorManager.enableColor(true).setColor(self.PENDING_COLOR);
               queue.push(child);

               args.self.recursiveCallStack.push({value : child.value, color : self.PENDING_COLOR, time : time});
               while (pauseEnqueue()) { yield; }
            }

            if (self.breakpoint.block()) {
               yield;
            }
         }
      },

      remove : function(value) {
         this.operationStack.push("remove(" + value + ")");
         const self = this;
         if (!this.operationMemory.active) {
            this.operationMemory.operation = (function() {
               const op = self._remove(value, self.root, null);

               return function(args) { return op.next(args); };

            }());
            this.operationMemory.active = true;
         }
      },

      _remove : function*(value, root, parent = null) {
         if (root == null) {
            return;
         }
         let current = root;
         let comp = null;

         let _depth = 0;

         const movementPause = LerpUtil.pauseAutoReset(0.6);

         while (current !== null) {
            _depth++;
            comp = current.value;
            if (value == comp) {
               current.colorManager.enableColor(true).setColor("red");
               // this.applyAll(function(node) {
               //    node.colorManager.enableColor(true).setColor("grey");
               // }, current.right);
               break;
            }
            current.colorManager.enableColor(true).setColor("purple");
            parent = current;
            if (value < comp) {
               // HIGHLIGHT UN-TRAVERSED SUB-TREE
               // this.applyAll(function(node) {
               //    node.colorManager.enableColor(true).setColor("grey");
               // }, current.right);

               current = current.left;
            }
            else {
               // HIGHLIGHT UN-TRAVERSED SUB-TREE
               // this.applyAll(function(node) {
               //    node.colorManager.enableColor(true).setColor("grey");
               // }, current.left);

               current = current.right;
            }

            while (movementPause()) { yield; }
         }

         // NODE TO REMOVE DOES NOT EXIST,ABORT
         // (NO WAY TO SPECIFY NON-EXISTING NODE YET : TODO)
         if (value != comp) {
            return;
         }

         let hasTwoChildren = false;
         // CASES 1 AND 2: 1 CHILD
         if (parent == null) {
            // SENTINEL
            parent = new BinarySearchTree.Node(-1);
         }
         if (parent.left == current) {
            if (current.left === null) {
               while (movementPause()) { yield; }

               parent.left = current.right;
            }
            else if (current.right === null) {
               while (movementPause()) { yield; }

               parent.left = current.left;
            }
            else {
               current.colorManager.enableColor(true).setColor("orange");
               hasTwoChildren = true;
            }
         }
         else if (parent.right == current) {
            if (current.left === null) {
               while (movementPause()) { yield; }

               parent.right = current.right;
            }
            else if (current.right === null) {
               while (movementPause()) { yield; }

               parent.right = current.left;
            }
            else {
               current.colorManager.enableColor(true).setColor("orange");
               hasTwoChildren = true;
            }
         }
         else if (current.left == null && current.right == null) {
            while (movementPause()) { yield; }

            this.root = null;
         }
         else {
            current.colorManager.enableColor(true).setColor("orange");
            hasTwoChildren = true;
         }

         if (!hasTwoChildren) {
            // CHECK WHETHER MAXIMUM DEPTH HAS DECREASED
            this.depthCounts[_depth]--;
            if (this.depthCounts[_depth] == 0 && this.depth == _depth) {
               this.depth = _depth - 1;
               // STRETCH THE TREE INWARDS
               const stretch = this._stretchPositions(this.root, 0.6);
               while (!stretch.next().done) {
                  yield;
               }
            }
            return;
         }

         
         this.breakpoint.block();

         // CASE 3 : FIND A PREDECESSOR

         // NAVIGATE BRANCH TO FIND PREDECESSOR
         let find = current.left;
         _depth++;
         let copyVal = 0;

         while (movementPause()) { yield; }

         find.colorManager.enableColor(true).setColor("cyan");

         while (movementPause()) { yield; }

         // UNUSED
         // WOULD HIGHLIGHT SUB-TREE
         // this.applyAll(function(node) {
         //    node.colorManager.enableColor(true).setColor("grey");
         // }, find.left);

         while (find.right !== null) {
            _depth++;

            find = find.right;
            find.colorManager.enableColor(true).setColor("cyan");

            // UNUSED
            // WOULD HIGHLIGHT SUB-TREE
            // this.applyAll(function(node) {
            //    node.colorManager.enableColor(true).setColor("grey");
            // }, find.left);

            if (find.right == null) {
               break;
            }
            
            while (movementPause()) { yield; }
         }

         find.colorManager.enableColor(true).setColor("orange");

         while (movementPause()) { yield; }

         this.breakpoint.block();

         // MOVE THE COPY VALUE (VISUALLY)
         const c1 = find.center;
         const c2 = current.center;
         let valMoveAni = LerpUtil.create(
            LerpUtil.Type.LINE({
               start : { x : c1[0], y : c1[1] },
               end : { x : c2[0], y : c2[1] }
            }),
            .6,
            true
         );
         let ret = {};
         while (!ret.done) {
            ret = valMoveAni.step();
            textHeight(this.sketchCtx.mScale(.4));
            mText(find.value, ret.point, .5, .5, .5);
            yield;
         }

         current.value = find.value;

         while (movementPause()) { yield; }

         current.colorManager.enableColor(true).setColor("purple");

         while (movementPause()) { yield; }

         yield *this._remove(current.value, current.left, current);

         // CHECK WHETHER MAXIMUM DEPTH HAS DECREASED
         this.depthCounts[_depth]--;
         if (this.depthCounts[_depth] == 0 && this.depth == _depth) {
            this.depth = _depth - 1;
            // STRETCH THE TREE INWARDS
            const stretch = this._stretchPositions(this.root, 0.6);
            while (!stretch.next().done) {
               yield;
            }
         }
      },

      insert : function(value) {
         this.operationStack.push("insert(" + value + ")");
         // THIS WILL BE A COMMON PATTERN THAT I'LL TRY TO ABSTRACT AWAY LATER
         const self = this;
         if (!this.operationMemory.active) {
            this.operationMemory.operation = (function() {
               const op = self._insert(value);

               return function(args) { return op.next(args); };

            }());
            this.operationMemory.active = true;
         }
      },
      _insert : function*(value) {
         const toInsert = new BinarySearchTree.Node(value);
         toInsert.colorManager.enableColor(true).setColor("green");
         if (this.root === null) {
            this.root = toInsert;
            this.depth = 1;
            this.depthCounts[0] = 1;
            return;
         }

         let parent = null;
         let current = this.root;
         let comp = null;

         let _depth = 1;

         while (current !== null) {
            _depth++;
            current.colorManager.enableColor(true).setColor("purple");
            parent = current;
            comp = current.value;
            if (value == comp) {
               return;
            }
            else if (value < comp) {
               // HIGHLIGHT UN-TRAVERSED SUB-TREE
               // this.applyAll(function(node) {
               //    node.colorManager.enableColor(true).setColor("grey");
               // }, current.right);

               current = current.left;
            }
            else {
               // HIGHLIGHT UN-TRAVERSED SUB-TREE
               // this.applyAll(function(node) {
               //    node.colorManager.enableColor(true).setColor("grey");
               // }, current.left);

               current = current.right;
            }

            for (let p = LerpUtil.pause(.6, this.sketchCtx); p();) { yield; }

         }

         if (value < comp) {
            parent.left = toInsert;
         }
         else {
            parent.right = toInsert;
         }

         // TODO : DO NOT STRETCH AT ALL DEPTHS, POSSIBLY DO STRETCH AT DIFFERENT TIME
         this.depthCounts[_depth] = (this.depthCounts[_depth] !== undefined) ? this.depthCounts[_depth] + 1 : 1;
         if (this.depth < _depth) {
            this.depth = _depth;
         }
         else {
            return;
         }

         // STRETCH THE TREE OUTWARDS
         const stretch = this._stretchPositions(this.root, 0.6);
         while (!stretch.next().done) {
            yield;
         }
      },

      _stretchPositions : function*(root, duration) {
         // CREATE AN ARRAY OF THE ORIGINAL NODE POSITIONS
         function getOriginalPositions(root, arr, nodeArr) {
            if (root == null || root.center == undefined) {
               return;
            }
            arr.push(root.center);
            nodeArr.push(root);
            
            getOriginalPositions(root.left, arr, nodeArr);
            getOriginalPositions(root.right, arr, nodeArr);
         }
         // TRAVERSE THE TREE AND CALCULATE THE NEW NODE POSITIONS
         // WITHOUT MUTATING THE TREE,
         // RETURN AN ARRAY OF THESE NEW POSITIONS
         // (SAME ORDER AS IN getOriginalPositions())
         const that = this;
         function getNewPositions(root, arr) {
            that._predictTreeLayout(root, arr);
         }

         const starts = [];
         const nodes = [];
         const ends = [];
         // GET CURRENT NODE POSITIONS AND POINTERS TO NODES
         getOriginalPositions(root, starts, nodes);
         // CALCULATE NEW NODE POSITIONS FOR STRETCHED TREE
         getNewPositions(root, ends);

         // CREATE LINEAR INTERPOLATION OBJECTS FOR EACH NODE'S
         // MOVEMENT TOWARDS THEIR NEW POSITIONS
         const transitions = [];
         for (let t = 0; t < starts.length; t++) {
            transitions.push(
               LerpUtil.create(
                  LerpUtil.Type.LINE({
                     start : {x : starts[t][0], y : starts[t][1]},
                     end : {x : ends[t][0], y : ends[t][1]}
                  }),
                  duration,
               )
            );
         }

         // MOVE THE NODES UNTIL THEY REACH THEIR END POSITIONS
         let done = true;
         let status = null;
         do {
            done = true;
            for (let t = 0; t < transitions.length; t++) {
               status = transitions[t].step();
               nodes[t].center = status.point;
               done &= status.done;
            }  
            yield;             
         } while (!done);
      },

      size : function(node) {
         if (node === undefined) {
            node = this.root;
         }
         return this._size(this.root);
      },

      _size : function(node) {
         if (node === null) {
            return 0;
         }
         return this._size(node.left) + 1 + this._size(node.right);
      },

      copyData : function(oldNode) {
         const newNode = new BinarySearchTree.Node(oldNode.value, oldNode.center);

         if (oldNode.left !== null){
            newNode.left = this.copyData(oldNode.left)
         }
         if (oldNode.right !== null){
            newNode.right = this.copyData(oldNode.right);
         }
         return newNode;
      },
      clone : function() {
         const newBST = new BinarySearchTree(this.sketchCtx);
         const oldNode = this.root;
         if (this.root === null) {
            return newBST;
         }

         newBST.root = new BinarySearchTree.Node(oldNode.value, oldNode.center);
         newBST.depth = this.depth;
         if (oldNode.left !== null) {
            newBST.root.left = this.copyData(oldNode.left);
         }
         if (oldNode.right !== null) {
            newBST.root.right = this.copyData(oldNode.right);
         }

         return newBST;

      },

      setState : function(now, past) {
         now.root = past.root;
         now.depth = past.depth;
      },

      saveState : function() {
         if (!this.isAcceptingInput) {
            return;
         }

         if (this.useOldHistory) {
            this.historyStack.push(this.clone());
            const newBST = this.historyStack[this.historyStack.length - 1];
            this.root = newBST.root;
            return;
         }

         // TODO
         // this.history.saveState(this.clone(), this.setState);
      },

      restorePast : function() {
         if (!this.isAcceptingInput) {
            return;
         }

         if (this.useOldHistory) {
            if (this.historyStack.length <= 1) {
               return;
            }
            const temp = this.historyStack.pop();
            const oldBST = this.historyStack[this.historyStack.length - 1];

            this.root = oldBST.root;
            this.depth = oldBST.depth;
         }

         // TODO
         // this.history.restorePast(this, this.setState);
      },

      restoreFuture : function() {
         if (!this.isAcceptingInput) {
            return;
         }
         // TODO
         // this.history.restoreFuture(this, this.setState);
      },

      _sortedArrayToBST : function(arr, start, end) {
         if (start > end){
            return null;
         }
         const mid = Math.trunc((start + end) / 2);
         const node = new BinarySearchTree.Node(arr[mid]);
         this.operationStack.push("insert(" + arr[mid] + ")");
         node.left = this._sortedArrayToBST(arr, start, mid - 1);
         node.right = this._sortedArrayToBST(arr, mid + 1, end);
         return node;
      },

      createArrWithDepth : function(depth) {
         const height = depth - 1;
         const maxVal = pow(2, height + 1) - 1;
         const arr = [];
         for (let i = 1; i <= maxVal; i++) {
            arr.push(i);
         }
         return arr;
      },

      createBSTWithDepth : function(value) {
         this.depth = value;
         // TODO MAKE MORE EFFICIENT WITH PRE-CALCULATION
         const arr = this.createArrWithDepth(value);
         let count = 1;
         this.depthCounts = {};
         for (let i = 1; i <= value; i++) {
            this.depthCounts[i] = count;
            count *= 2;
         }
         return this._sortedArrayToBST(arr, 0, arr.length - 1);
      },

      print : function() {
         if (this.root === null) {
            return;
         }
         this.root.print();
      },

      _predictTreeLayout : function(node, arr, center = [0, 0], radius = 0.5, xOffset = 5, yOffset = 2, zOffset = 0) {
         if (node === null) {
            return;
         }

         function traverseTree(node, arr, center, radius, parentCenter, parentRadius, xOffset = 5, yOffset = 2, zOffset = 0) {
            // TODO, GIVE THE NEWLY INSERTED OR REMOVED NODE 
            // A DEFAULT CENTER FOR THE TREE STRETCHING ANIMATION
            if (node.center === undefined) {
               return;
            }
            arr.push(center);

            if (node.left !== null) {
               const newCenter = [center[0] - xOffset * radius,center[1] - yOffset * radius];
               traverseTree(node.left, arr, newCenter, radius, center, radius, xOffset / 2);
            }
            if (node.right !== null) {
               const newCenter = [center[0] + xOffset * radius,center[1] - yOffset * radius];
               traverseTree(node.right, arr, newCenter, radius, center, radius, xOffset / 2);
            }
         }

         const depth = this.depth;

         if (depth > 4){
            traverseTree(node, arr, center, radius, undefined, undefined, 20);
         }
         else if (depth > 3){
            traverseTree(node, arr, center, radius, undefined, undefined, 10);
         }
         else if (depth > 0) {
            traverseTree(node, arr, center, radius);
         }
      },

      // CHECK IF POINT LIES WITHIN CIRCLE
      inCircle : function(node, clickLocation){
         const dist = Math.sqrt((clickLocation[0] - node.center[0]) * (clickLocation[0] - node.center[0]) +
                             (clickLocation[1] - node.center[1]) * (clickLocation[1] - node.center[1]));
         return dist < 0.5;
      },

      _findClickedNode : function(node, clickLocation) {
         if (!this.inCircle(node, clickLocation)) {
            if (node.center[0] > clickLocation[0]) {
               if (node.left !== null){
                  return this.findClickedNode(node.left, clickLocation);
               }
               return null;
            }
            else {
               if (node.right !== null) {
                  return this.findClickedNode(node.right, clickLocation);
               }
               return null;
            }
         }
         return node;
      },

      findClickedNode : function(node, clickLocation) {
         return (node === null) ?
                  null : this._findClickedNode(node, clickLocation);
      },

      _drawEmpty : function(center, radius = 0.5) {
         const left = center[0] - radius;
         const right = center[0] + radius;
         const bottom = center[1] - radius;
         const top = center[1] + radius;
         color("grey");
         mDrawOval([left, bottom], [right, top], 32, PI / 2 - TAU);

         color("blue");
         textHeight(this.sketchCtx.mScale(.2));
         mText("nullptr", center, .5, .5, .5);
      },

      _drawTree : function(node, center, radius, xOffset = 5, yOffset = 2) {
         if (node === null) {
            return;
         }

         function drawParentToChildEdge(center, radius, childCenter) {
            if (childCenter == undefined) {
               return;
            }
            const childParentVec = [childCenter[0] - center[0], childCenter[1] - center[1]];
            const childParentDist = sqrt(pow(childParentVec[0], 2) + pow(childParentVec[1], 2));

            const edgeOfParent = [center[0] + radius / childParentDist * childParentVec[0], center[1] + radius / childParentDist * childParentVec[1]];
            const edgeOfChild = [childCenter[0] - radius / childParentDist * childParentVec[0], childCenter[1] - radius / childParentDist * childParentVec[1]];
            mLine(edgeOfParent, edgeOfChild);
         }

         if (this.mustInitializePositions()) {
            node.center = center;
         }

         // TODO : DON'T ADD NEW NODE UNTIL REST OF TREE HAS MOVED TO CORRECT POSITIONS, THIS IS A TEMPORARY FIX
         if (node.center == undefined) {
            return;
         }

         center = node.center;

         node.drawNode(center, radius);

         if (node.left !== null) {
            const newCenter = (this.mustInitializePositions()) ?
                           [center[0] - xOffset * radius, center[1] - yOffset * radius] :
                           node.left.center;

            this._drawTree(node.left, [center[0] - xOffset * radius, center[1] - yOffset * radius], radius, xOffset / 2);
            drawParentToChildEdge(center, radius, newCenter);
         }
         if (node.right !== null) {
            const newCenter = (this.mustInitializePositions()) ?
                           [center[0] + xOffset * radius, center[1] - yOffset * radius] :
                           node.right.center;

            this._drawTree(node.right, [center[0] + xOffset * radius, center[1] - yOffset * radius], radius, xOffset / 2);
            drawParentToChildEdge(center, radius, newCenter);
         }
      },

      drawTree : function(center = [0, 0], radius = 0.5, xOffset = 5, yOffset = 2) {
         const depth = this.depth;
         if (depth > 4) {
            this._drawTree(this.root, center, radius, 20);
         }
         else if (depth > 3) {
            this._drawTree(this.root, center, radius, 10);
         }
         else if (depth > 0) {
            this._drawTree(this.root, center, radius);
         }
         else {
            this._drawEmpty(center, radius);
         }

         this._mustInitializePositions = false;
      },

      _applyAll : function(func, node) {
         func(node);
         if (node.left !== null) {
            this._applyAll(func, node.left);
         }
         if (node.right !== null) {
            this._applyAll(func, node.right);
         }
      },

      applyAll : function(func, node) {
         node = (node === undefined) ? this.root : node;
         if (node == null) {
            return;
         }
         this._applyAll(func, node);
      },

      resetTemporaryGraphics : function() {
         this.applyAll(function(node) {
            // RESET COLORS
            node.colorManager.enableColor(false);
         });
      }
   };
}
