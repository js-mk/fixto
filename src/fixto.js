import MimicNode from './mimic-node';
import {prefix} from './prefix';
import positioningContext from './PositioningContext';
import 'computed-style';
const computedStyle = window.computedStyle;

window.fixto = (function ($, window, document) {

    // Will hold if browser creates a positioning context for fixed elements.
    let fixedPositioningContext;

    // It will return null if position sticky is not supported
    const nativeStickyValue = prefix.getCssValue('position', 'sticky');

    // It will return null if position fixed is not supported
    const fixedPositionValue = prefix.getCssValue('position', 'fixed');

    // Dirty business
    var ie = navigator.appName === 'Microsoft Internet Explorer';
    var ieversion;

    if(ie){
        ieversion = parseFloat(navigator.appVersion.split("MSIE")[1]);
    }

    function FixTo(child, parent, options) {
        this.child = child;
        this._$child = $(child);
        this.parent = parent;
        this.options = {
            className: 'fixto-fixed',
            top: 0,
            mindViewport: false
        };
        this._setOptions(options);
    }

    FixTo.prototype = {
        // Returns the total outerHeight of the elements passed to mind option. Will return 0 if none.
        _mindtop: function () {
            var top = 0;
            if(this._$mind) {
                var el;
                var rect;
                for(var i=0, l=this._$mind.length; i<l; i++) {
                    el = this._$mind[i];
                    rect = el.getBoundingClientRect();
                    if(rect.height) {
                        top += rect.height;
                    }
                    else {
                        var styles = computedStyle.getAll(el);
                        top += el.offsetHeight + computedStyle.toFloat(styles.marginTop) + computedStyle.toFloat(styles.marginBottom);
                    }
                }
            }
            return top;
        },

        // Public method to stop the behaviour of this instance.
        stop: function () {
            this._stop();
            this._running = false;
        },

        // Public method starts the behaviour of this instance.
        start: function () {

            // Start only if it is not running not to attach event listeners multiple times.
            if(!this._running) {
                this._start();
                this._running = true;
            }
        },

        //Public method to destroy fixto behaviour
        destroy: function () {
            this.stop();

            this._destroy();

            // Remove jquery data from the element
            this._$child.removeData('fixto-instance');

            // set properties to null to break references
            for (var prop in this) {
                if (this.hasOwnProperty(prop)) {
                  this[prop] = null;
                }
            }
        },

        _setOptions: function(options) {
            $.extend(this.options, options);
            if(this.options.mind) {
                this._$mind = $(this.options.mind);
            }
            if(this.options.zIndex) {
                this.child.style.zIndex = this.options.zIndex;
            }
        },

        setOptions: function(options) {
            this._setOptions(options);
            this.refresh();
        },

        // Methods could be implemented by subclasses

        _stop: function() {

        },

        _start: function() {

        },

        _destroy: function() {

        },

        refresh: function() {

        }
    };

    // Class FixToContainer
    function FixToContainer(child, parent, options) {
        FixTo.call(this, child, parent, options);
        this._replacer = new MimicNode(child);
        this._ghostNode = this._replacer.replacer;

        this._saveStyles();

        this._saveViewportHeight();

        // Create anonymous functions and keep references to register and unregister events.
        this._proxied_onscroll = this._bind(this._onscroll, this);
        this._proxied_onresize = this._bind(this._onresize, this);

        this.start();
    }

    FixToContainer.prototype = new FixTo();

    $.extend(FixToContainer.prototype, {

        // Returns an anonymous function that will call the given function in the given context
        _bind : function (fn, context) {
            return function () {
                return fn.call(context);
            };
        },

        // at ie8 maybe only in vm window resize event fires everytime an element is resized.
        _toresize : ieversion===8 ? document.documentElement : window,

        _onscroll: function _onscroll() {
            this._scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
            this._parentBottom = (this.parent.offsetHeight + this._fullOffset('offsetTop', this.parent));

            if (this.options.mindBottomPadding !== false) {
                this._parentBottom -= computedStyle.getFloat(this.parent, 'paddingBottom');
            }

            if (this.fixed) {
                if (this._scrollTop > this._parentBottom || this._scrollTop < (this._fullOffset('offsetTop', this._ghostNode) - this.options.top - this._mindtop())) {
                    this._unfix();
                    return;
                }
                this._adjust();
            } else if (this._shouldFix()) {
                this._fix();
                this._adjust();
            }
        },

        _shouldFix: function() {
            if (this._scrollTop < this._parentBottom && this._scrollTop > (this._fullOffset('offsetTop', this.child) - this.options.top - this._mindtop())) {
                if (this.options.mindViewport && !this._isViewportAvailable()) {
                    return false;
                }
                return true;
            }
        },

        _isViewportAvailable: function() {
            var childStyles = computedStyle.getAll(this.child);
            return this._viewportHeight > (this.child.offsetHeight + computedStyle.toFloat(childStyles.marginTop) + computedStyle.toFloat(childStyles.marginBottom));
        },

        _adjust: function _adjust() {
            var top = 0;
            var mindTop = this._mindtop();
            var diff = 0;
            var childStyles = computedStyle.getAll(this.child);
            var context = null;

            if(fixedPositioningContext) {
                // Get positioning context.
                context = positioningContext.getContext(this.child);
                if(context) {
                    // There is a positioning context. Top should be according to the context.
                    top = Math.abs(context.getBoundingClientRect().top);
                }
            }

            diff = (this._parentBottom - this._scrollTop) - (this.child.offsetHeight + computedStyle.toFloat(childStyles.marginBottom) + mindTop + this.options.top);

            if(diff>0) {
                diff = 0;
            }

            this.child.style.top = (diff + mindTop + top + this.options.top) - computedStyle.toFloat(childStyles.marginTop) + 'px';
        },

        // Calculate cumulative offset of the element.
        // Optionally according to context
        _fullOffset: function _fullOffset(offsetName, elm, context) {
            var offset = elm[offsetName];
            var offsetParent = elm.offsetParent;

            // Add offset of the ascendent tree until we reach to the document root or to the given context
            while (offsetParent !== null && offsetParent !== context) {
                offset = offset + offsetParent[offsetName];
                offsetParent = offsetParent.offsetParent;
            }

            return offset;
        },

        _fix: function _fix() {
            var child = this.child;
            var childStyle = child.style;
            var childStyles = computedStyle.getAll(child);
            var left = child.getBoundingClientRect().left;
            var width = childStyles.width;

            this._saveStyles();

            if(document.documentElement.currentStyle){
                // Function for ie<9. When hasLayout is not triggered in ie7, he will report currentStyle as auto, clientWidth as 0. Thus using offsetWidth.
                // Opera also falls here
                width = (child.offsetWidth) - (computedStyle.toFloat(childStyles.paddingLeft) + computedStyle.toFloat(childStyles.paddingRight) + computedStyle.toFloat(childStyles.borderLeftWidth) + computedStyle.toFloat(childStyles.borderRightWidth)) + 'px';
            }

            // Ie still fixes the container according to the viewport.
            if(fixedPositioningContext) {
                var context = positioningContext.getContext(this.child);
                if(context) {
                    // There is a positioning context. Left should be according to the context.
                    left = child.getBoundingClientRect().left - context.getBoundingClientRect().left;
                }
            }

            this._replacer.replace();

            childStyle.left = (left - computedStyle.toFloat(childStyles.marginLeft)) + 'px';
            childStyle.width = width;

            childStyle.position = 'fixed';
            childStyle.top = this._mindtop() + this.options.top - computedStyle.toFloat(childStyles.marginTop) + 'px';
            this._$child.addClass(this.options.className);
            this.fixed = true;
        },

        _unfix: function _unfix() {
            var childStyle = this.child.style;
            this._replacer.hide();
            childStyle.position = this._childOriginalPosition;
            childStyle.top = this._childOriginalTop;
            childStyle.width = this._childOriginalWidth;
            childStyle.left = this._childOriginalLeft;
            this._$child.removeClass(this.options.className);
            this.fixed = false;
        },

        _saveStyles: function(){
            var childStyle = this.child.style;
            this._childOriginalPosition = childStyle.position;
            this._childOriginalTop = childStyle.top;
            this._childOriginalWidth = childStyle.width;
            this._childOriginalLeft = childStyle.left;
        },

        _onresize: function () {
            this.refresh();
        },

        _saveViewportHeight: function () {
            // ie8 doesn't support innerHeight
            this._viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        },

        _stop: function() {
            // Unfix the container immediately.
            this._unfix();
            // remove event listeners
            $(window).unbind('scroll', this._proxied_onscroll);
            $(this._toresize).unbind('resize', this._proxied_onresize);
        },

        _start: function() {
            // Trigger onscroll to have the effect immediately.
            this._onscroll();

            // Attach event listeners
            $(window).bind('scroll', this._proxied_onscroll);
            $(this._toresize).bind('resize', this._proxied_onresize);
        },

        _destroy: function() {
            // Destroy mimic node instance
            this._replacer.destroy();
        },

        refresh: function() {
            this._saveViewportHeight();
            this._unfix();
            this._onscroll();
        }
    });

    function NativeSticky(child, parent, options) {
        FixTo.call(this, child, parent, options);
        this.start();
    }

    NativeSticky.prototype = new FixTo();

    $.extend(NativeSticky.prototype, {
        _start: function() {

            var childStyles = computedStyle.getAll(this.child);

            this._childOriginalPosition = childStyles.position;
            this._childOriginalTop = childStyles.top;

            this.child.style.position = nativeStickyValue;
            this.refresh();
        },

        _stop: function() {
            this.child.style.position = this._childOriginalPosition;
            this.child.style.top = this._childOriginalTop;
        },

        refresh: function() {
            this.child.style.top = this._mindtop() + this.options.top + 'px';
        }
    });



    var fixTo = function fixTo(childElement, parentElement, options) {
        if((nativeStickyValue && !options) || (nativeStickyValue && options && options.useNativeSticky !== false)) {
            // Position sticky supported and user did not disabled the usage of it.
            return new NativeSticky(childElement, parentElement, options);
        }
        else if(fixedPositionValue) {
             // Position fixed supported

             if(fixedPositioningContext===undefined) {
                // We don't know yet if browser creates fixed positioning contexts. Check it.
                fixedPositioningContext = positioningContext.createsContext();
             }

            return new FixToContainer(childElement, parentElement, options);
        }
        else {
            return 'Neither fixed nor sticky positioning supported';
        }
    };

    /*
    No support for ie lt 8
    */

    if(ieversion<8){
        fixTo = function(){
            return 'not supported';
        };
    }

    // Let it be a jQuery Plugin
    $.fn.fixTo = function (targetSelector, options) {

         var $targets = $(targetSelector);

         var i = 0;
         return this.each(function () {

             // Check the data of the element.
             var instance = $(this).data('fixto-instance');

             // If the element is not bound to an instance, create the instance and save it to elements data.
             if(!instance) {
                 $(this).data('fixto-instance', fixTo(this, $targets[i], options));
             }
             else {
                 // If we already have the instance here, expect that targetSelector parameter will be a string
                 // equal to a public methods name. Run the method on the instance without checking if
                 // it exists or it is a public method or not. Cause nasty errors when necessary.
                 var method = targetSelector;
                 instance[method].call(instance, options);
             }
             i++;
          });
    };

    /*
        Expose
    */

    return {
        FixToContainer: FixToContainer,
        fixTo: fixTo,
        computedStyle:computedStyle,
        MimicNode: MimicNode
    };


}(window.jQuery, window, document));