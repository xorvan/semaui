/**
 * @license AngularJS v1.2.16
 * (c) 2010-2014 Google, Inc. http://angularjs.org
 * License: MIT
 */
(function(window, angular, undefined) {'use strict';

var __IEBUG_PARAMS__  = ~navigator.userAgent.indexOf("MSIE") || ~navigator.userAgent.indexOf("Trident") ? {__IEBUG__: (new Date)*1} : {};

function resolveUrl(url, base_url) {
  var doc      = document
    , old_base = doc.getElementsByTagName('base')[0]
    , old_href = old_base && old_base.href
    , doc_head = doc.head || doc.getElementsByTagName('head')[0]
    , our_base = old_base || doc_head.appendChild(doc.createElement('base'))
    , resolver = doc.createElement('a')
    , resolved_url
    ;
  our_base.href = base_url;
  resolver.href = url;
  resolved_url  = resolver.href; // browser magic at work here
 
  if (old_base) old_base.href = old_href;
  else doc_head.removeChild(our_base);
 
  return resolved_url;
}

function parseLink(link) {
  try {
    var parts     =  link.split(';')
      , linkUrl   =  parts.shift().replace(/[<>]/g, '').trim()

    var info = parts
      .reduce(function (acc, p) {
        // rel="next" => 1: rel 2: next
        var m = p.match(/ *(.+) *= *("|')(.+)("|')/)
        if (m) acc[m[1]] = m[3];
        return acc;
      }, {});
    
    info.url = linkUrl;
    return info;
  } catch (e) {
    return null;
  }
}

function parseLinks(linkHeader, base) {
   if (!linkHeader) return null;
   var all = linkHeader.split(',')
    .map(parseLink)
    .filter(function (x) { return x && x.rel; })

  var map = all
    .reduce(function (acc, x) {
      var l = resolveUrl(x.url, base);
      if(acc[x.rel]){
        if(acc[x.rel] instanceof Array){
          acc[x.rel].push(l);
        }else{
          acc[x.rel] = [acc[x.rel], l];
        }
      }else{
        acc[x.rel] = l;
      }
      return acc;
    }, {});

  map.$all = all;
  return map;
};

/**
 * @ngdoc module
 * @name ngRoute
 * @description
 *
 * # ngRoute
 *
 * The `ngRoute` module provides routing and deeplinking services and directives for angular apps.
 *
 * ## Example
 * See {@link ngRoute.$route#example $route} for an example of configuring and using `ngRoute`.
 *
 *
 * <div doc-module-components="ngRoute"></div>
 */
 /* global -ngRouteModule */
var ngRouteModule = angular.module('semaui', ['ng']).
  factory("semaResource", function($http, $window){
    Resource.getRoot = function(){
      return $http({method: "GET", url:"/", headers: {"Accept": "application/ld+json, application/json"}, params: __IEBUG_PARAMS__})
      .then(function(response){
        return new Resource(response.data, resolveUrl("/"), response.headers);
      });
    }
    Resource.http = function(config){
      if(!config.headers){
        config.headers = {};
      }

      if(!config.headers.Accept){
        config.headers.Accept = "application/ld+json, application/json";
      }

      if(!config.params){
        config.params = __IEBUG_PARAMS__;
      }else if(__IEBUG_PARAMS__.__IEBUG__){
        config.params.__IEBUG__ =  __IEBUG_PARAMS__.__IEBUG__;
      }

      return $http(config)
      .then(function(response){
        return new Resource(response.data, resolveUrl(config.url), response.headers);
      });
    }
    Resource.resolve = resolve;
    return Resource
  }).
  provider('$route', $RouteProvider).

  directive('semaInfiniteScroll', function() {
    return {
      // restrict: 'M',
      scope: {resource: "&semaInfiniteScroll"},
      controller: function($scope, $element, $attrs, $transclude, $location, $timeout){
        var items = this.items = [], routeUpdateInitiated;

        var offset = 600, 
          prevScroll = 0,
          loading = false;

        function getPath(fullUrl) { 
            var baseLen = $location.absUrl().length - $location.url().length;
            return fullUrl.substring(baseLen);
        }


        var scrollList = function(e){
          if(Math.abs(prevScroll - $(window).scrollTop()) < 10 || routeUpdateInitiated){
            return false;
          }
          var p = false;
          for(var i=1; i < items.length; i++){
            if(items[i].page == p) continue;

            var r = items[i].element[0].getBoundingClientRect();
            if(r.top > 10){
              $timeout(function(){
                $location.url(getPath(p || items[i].page)).replace();
              });
              break;
            }else{
              p = items[i].page;
            }
          }

          if (prevScroll < $(window).scrollTop() && $(window).scrollTop() >= $(document).height() - $(window).height() - offset){
            if(!loading){
              $scope.$apply(function(){
                loading = true;
                $scope.$eval($scope.resource).$include("next", function(){
                  loading = false;
                }, function(){
                  loading = false;
                })
              })              
            }
            
          } else if (prevScroll > $(window).scrollTop() && $(window).scrollTop() - offset <= 0 ){
            // TODO: implementing reverse scroll
          }

          prevScroll = $(window).scrollTop();
        };

        $scope.$on("$routeUpdateRequest", function(){
          routeUpdateInitiated = true;
        });

        $scope.$on("$routeUpdate", function(){
          routeUpdateInitiated = false;
        });

        $scope.$on("$routeChangeError", function(){
          routeUpdateInitiated = false;
        });

        $scope.$on("$routeChangeStart", function(){
          $(document).unbind("scroll", scrollList);
        });

        $(document).bind("scroll", scrollList);

      },
        
      link: function(scope, elm, attrs) {


      }
    };
  }).
  directive('semaScrollSpy', function() {
    return {
      // restrict: 'M',
      scope: {item: "&semaScrollSpy"},
      require: '^semaInfiniteScroll',
      link: function(scope, elm, attrs, semaInfiniteScroll) {
        var item = scope.$eval(scope.item);
        semaInfiniteScroll.items.push({
          page: item.$page,
          element: elm,
          hash: item.$$hashKey
        });
        scope.$on("$destroy", function(){
          for(var i = 0; i < semaInfiniteScroll.items.length; i++){
            if(semaInfiniteScroll.items[0].hash == item.$$hashKey){
              semaInfiniteScroll.items.splice(i, 1);
              break;
            }
          }
        })
      }
    };
  });



function shallowClearAndCopy(src, dst) {
  dst = dst || {};

  angular.forEach(dst, function(value, key){
    delete dst[key];
  });

  for (var key in src) {
    if (src.hasOwnProperty(key) && !(key.charAt(0) === '$' && key.charAt(1) === '$')) {
      dst[key] = src[key];
    }
  }

  return dst;
}

var prefixes = {};

function resolve(iri){
  var parts = /^([^:]*:)([^\/:]*)$/.exec(iri);
  if(parts && prefixes[parts[1]]){
    return prefixes[parts[1]] + parts[2]
  }
  return iri;
};


function Resource(body, id, headers){
  this.$process(body, id, headers)
}

/**
 * @ngdoc provider
 * @name $routeProvider
 * @function
 *
 * @description
 *
 * Used for configuring routes.
 *
 * ## Example
 * See {@link ngRoute.$route#example $route} for an example of configuring and using `ngRoute`.
 *
 * ## Dependencies
 * Requires the {@link ngRoute `ngRoute`} module to be installed.
 */
function $RouteProvider(){
  function inherit(parent, extra) {
    return angular.extend(new (angular.extend(function() {}, {prototype:parent}))(), extra);
  }

  var routes = {},
    codes = {},
    lastPriority = 1,
    types = {};


  /**
   * @ngdoc method
   * @name $routeProvider#when
   *
   * @param {string} path Route path (matched against `$location.path`). If `$location.path`
   *    contains redundant trailing slash or is missing one, the route will still match and the
   *    `$location.path` will be updated to add or drop the trailing slash to exactly match the
   *    route definition.
   *
   *    * `path` can contain named groups starting with a colon: e.g. `:name`. All characters up
   *        to the next slash are matched and stored in `$routeParams` under the given `name`
   *        when the route matches.
   *    * `path` can contain named groups starting with a colon and ending with a star:
   *        e.g.`:name*`. All characters are eagerly stored in `$routeParams` under the given `name`
   *        when the route matches.
   *    * `path` can contain optional named groups with a question mark: e.g.`:name?`.
   *
   *    For example, routes like `/color/:color/largecode/:largecode*\/edit` will match
   *    `/color/brown/largecode/code/with/slashes/edit` and extract:
   *
   *    * `color: brown`
   *    * `largecode: code/with/slashes`.
   *
   *
   * @param {Object} route Mapping information to be assigned to `$route.current` on route
   *    match.
   *
   *    Object properties:
   *
   *    - `controller` – `{(string|function()=}` – Controller fn that should be associated with
   *      newly created scope or the name of a {@link angular.Module#controller registered
   *      controller} if passed as a string.
   *    - `controllerAs` – `{string=}` – A controller alias name. If present the controller will be
   *      published to scope under the `controllerAs` name.
   *    - `template` – `{string=|function()=}` – html template as a string or a function that
   *      returns an html template as a string which should be used by {@link
   *      ngRoute.directive:ngView ngView} or {@link ng.directive:ngInclude ngInclude} directives.
   *      This property takes precedence over `templateUrl`.
   *
   *      If `template` is a function, it will be called with the following parameters:
   *
   *      - `{Array.<Object>}` - route parameters extracted from the current
   *        `$location.path()` by applying the current route
   *
   *    - `templateUrl` – `{string=|function()=}` – path or function that returns a path to an html
   *      template that should be used by {@link ngRoute.directive:ngView ngView}.
   *
   *      If `templateUrl` is a function, it will be called with the following parameters:
   *
   *      - `{Array.<Object>}` - route parameters extracted from the current
   *        `$location.path()` by applying the current route
   *
   *    - `resolve` - `{Object.<string, function>=}` - An optional map of dependencies which should
   *      be injected into the controller. If any of these dependencies are promises, the router
   *      will wait for them all to be resolved or one to be rejected before the controller is
   *      instantiated.
   *      If all the promises are resolved successfully, the values of the resolved promises are
   *      injected and {@link ngRoute.$route#$routeChangeSuccess $routeChangeSuccess} event is
   *      fired. If any of the promises are rejected the
   *      {@link ngRoute.$route#$routeChangeError $routeChangeError} event is fired. The map object
   *      is:
   *
   *      - `key` – `{string}`: a name of a dependency to be injected into the controller.
   *      - `factory` - `{string|function}`: If `string` then it is an alias for a service.
   *        Otherwise if function, then it is {@link auto.$injector#invoke injected}
   *        and the return value is treated as the dependency. If the result is a promise, it is
   *        resolved before its value is injected into the controller. Be aware that
   *        `ngRoute.$routeParams` will still refer to the previous route within these resolve
   *        functions.  Use `$route.current.params` to access the new route parameters, instead.
   *
   *    - `redirectTo` – {(string|function())=} – value to update
   *      {@link ng.$location $location} path with and trigger route redirection.
   *
   *      If `redirectTo` is a function, it will be called with the following parameters:
   *
   *      - `{Object.<string>}` - route parameters extracted from the current
   *        `$location.path()` by applying the current route templateUrl.
   *      - `{string}` - current `$location.path()`
   *      - `{Object}` - current `$location.search()`
   *
   *      The custom `redirectTo` function is expected to return a string which will be used
   *      to update `$location.path()` and `$location.search()`.
   *
   *    - `[reloadOnSearch=true]` - {boolean=} - reload route when only `$location.search()`
   *      or `$location.hash()` changes.
   *
   *      If the option is set to `false` and url in the browser changes, then
   *      `$routeUpdate` event is broadcasted on the root scope.
   *
   *    - `[caseInsensitiveMatch=false]` - {boolean=} - match routes without being case sensitive
   *
   *      If the option is set to `true`, then the particular route can be matched without being
   *      case sensitive
   *
   * @returns {Object} self
   *
   * @description
   * Adds a new route definition to the `$route` service.
   */
  this.when = function(path, route) {

    if(angular.isNumber(path)){
      codes[path] = angular.extend(
        {reloadOnSearch: true},
        route
      );

    }else{
      if(path && path[0] != "/") return this.type.apply(this, arguments);

      routes[path] = angular.extend(
        {reloadOnSearch: true},
        route,
        path && pathRegExp(path, route)
      );

      // create redirection for trailing slashes
      if (path) {
        var redirectPath = (path[path.length-1] == '/')
              ? path.substr(0, path.length-1)
              : path +'/';

        routes[redirectPath] = angular.extend(
          {redirectTo: path},
          pathRegExp(redirectPath, route)
        );
      }
    }

    return this;
  };

  this.register = function(prefix, iri){
    if(!iri){
      iri = prefix;
      prefix = "";
    }
    prefixes[prefix+":"] = iri;
    return this;
  };


  function Route(){

  }

  Route.prototype.is = function(type){
    return !!~this.types.indexOf(resolve(type));
  }


  this.type = function(type, hash, route){
    if(!route){
      route = hash;
      hash = "";
    }

    var type = resolve(type);
    if(!types[type]){
      types[type] = {};
    }
    types[type][hash] = angular.extend(new Route,
      {reloadOnSearch: true, priority: lastPriority ++},
      route
    );

    return this;
  }

   /**
    * @param path {string} path
    * @param opts {Object} options
    * @return {?Object}
    *
    * @description
    * Normalizes the given path, returning a regular expression
    * and the original path.
    *
    * Inspired by pathRexp in visionmedia/express/lib/utils.js.
    */
  function pathRegExp(path, opts) {
    var insensitive = opts.caseInsensitiveMatch,
        ret = {
          originalPath: path,
          regexp: path
        },
        keys = ret.keys = [];

    path = path
      .replace(/([().])/g, '\\$1')
      .replace(/(\/)?:(\w+)([\?\*])?/g, function(_, slash, key, option){
        var optional = option === '?' ? option : null;
        var star = option === '*' ? option : null;
        keys.push({ name: key, optional: !!optional });
        slash = slash || '';
        return ''
          + (optional ? '' : slash)
          + '(?:'
          + (optional ? slash : '')
          + (star && '(.+?)' || '([^/]+)')
          + (optional || '')
          + ')'
          + (optional || '');
      })
      .replace(/([\/$\*])/g, '\\$1');

    ret.regexp = new RegExp('^' + path + '$', insensitive ? 'i' : '');
    return ret;
  }

  /**
   * @ngdoc method
   * @name $routeProvider#otherwise
   *
   * @description
   * Sets route definition that will be used on route change when no other route definition
   * is matched.
   *
   * @param {Object} params Mapping information to be assigned to `$route.current`.
   * @returns {Object} self
   */
  this.otherwise = function(params) {
    this.when(null, params);
    return this;
  };


  this.$get = ['$rootScope',
               '$location',
               '$routeParams',
               '$q',
               '$injector',
               '$http',
               '$templateCache',
               '$sce',
      function($rootScope, $location, $routeParams, $q, $injector, $http, $templateCache, $sce) {

    /**
     * @ngdoc service
     * @name $route
     * @requires $location
     * @requires $routeParams
     *
     * @property {Object} current Reference to the current route definition.
     * The route definition contains:
     *
     *   - `controller`: The controller constructor as define in route definition.
     *   - `locals`: A map of locals which is used by {@link ng.$controller $controller} service for
     *     controller instantiation. The `locals` contain
     *     the resolved values of the `resolve` map. Additionally the `locals` also contain:
     *
     *     - `$scope` - The current route scope.
     *     - `$template` - The current route template HTML.
     *
     * @property {Object} routes Object with all route configuration Objects as its properties.
     *
     * @description
     * `$route` is used for deep-linking URLs to controllers and views (HTML partials).
     * It watches `$location.url()` and tries to map the path to an existing route definition.
     *
     * Requires the {@link ngRoute `ngRoute`} module to be installed.
     *
     * You can define routes through {@link ngRoute.$routeProvider $routeProvider}'s API.
     *
     * The `$route` service is typically used in conjunction with the
     * {@link ngRoute.directive:ngView `ngView`} directive and the
     * {@link ngRoute.$routeParams `$routeParams`} service.
     *
     * @example
     * This example shows how changing the URL hash causes the `$route` to match a route against the
     * URL, and the `ngView` pulls in the partial.
     *
     * Note that this example is using {@link ng.directive:script inlined templates}
     * to get it working on jsfiddle as well.
     *
     * <example name="$route-service" module="ngRouteExample"
     *          deps="angular-route.js" fixBase="true">
     *   <file name="index.html">
     *     <div ng-controller="MainController">
     *       Choose:
     *       <a href="Book/Moby">Moby</a> |
     *       <a href="Book/Moby/ch/1">Moby: Ch1</a> |
     *       <a href="Book/Gatsby">Gatsby</a> |
     *       <a href="Book/Gatsby/ch/4?key=value">Gatsby: Ch4</a> |
     *       <a href="Book/Scarlet">Scarlet Letter</a><br/>
     *
     *       <div ng-view></div>
     *
     *       <hr />
     *
     *       <pre>$location.path() = {{$location.path()}}</pre>
     *       <pre>$route.current.templateUrl = {{$route.current.templateUrl}}</pre>
     *       <pre>$route.current.params = {{$route.current.params}}</pre>
     *       <pre>$route.current.scope.name = {{$route.current.scope.name}}</pre>
     *       <pre>$routeParams = {{$routeParams}}</pre>
     *     </div>
     *   </file>
     *
     *   <file name="book.html">
     *     controller: {{name}}<br />
     *     Book Id: {{params.bookId}}<br />
     *   </file>
     *
     *   <file name="chapter.html">
     *     controller: {{name}}<br />
     *     Book Id: {{params.bookId}}<br />
     *     Chapter Id: {{params.chapterId}}
     *   </file>
     *
     *   <file name="script.js">
     *     angular.module('ngRouteExample', ['ngRoute'])
     *
     *      .controller('MainController', function($scope, $route, $routeParams, $location) {
     *          $scope.$route = $route;
     *          $scope.$location = $location;
     *          $scope.$routeParams = $routeParams;
     *      })
     *
     *      .controller('BookController', function($scope, $routeParams) {
     *          $scope.name = "BookController";
     *          $scope.params = $routeParams;
     *      })
     *
     *      .controller('ChapterController', function($scope, $routeParams) {
     *          $scope.name = "ChapterController";
     *          $scope.params = $routeParams;
     *      })
     *
     *     .config(function($routeProvider, $locationProvider) {
     *       $routeProvider
     *        .when('/Book/:bookId', {
     *         templateUrl: 'book.html',
     *         controller: 'BookController',
     *         resolve: {
     *           // I will cause a 1 second delay
     *           delay: function($q, $timeout) {
     *             var delay = $q.defer();
     *             $timeout(delay.resolve, 1000);
     *             return delay.promise;
     *           }
     *         }
     *       })
     *       .when('/Book/:bookId/ch/:chapterId', {
     *         templateUrl: 'chapter.html',
     *         controller: 'ChapterController'
     *       });
     *
     *       // configure html5 to get links working on jsfiddle
     *       $locationProvider.html5Mode(true);
     *     });
     *
     *   </file>
     *
     *   <file name="protractor.js" type="protractor">
     *     it('should load and compile correct template', function() {
     *       element(by.linkText('Moby: Ch1')).click();
     *       var content = element(by.css('[ng-view]')).getText();
     *       expect(content).toMatch(/controller\: ChapterController/);
     *       expect(content).toMatch(/Book Id\: Moby/);
     *       expect(content).toMatch(/Chapter Id\: 1/);
     *
     *       element(by.partialLinkText('Scarlet')).click();
     *
     *       content = element(by.css('[ng-view]')).getText();
     *       expect(content).toMatch(/controller\: BookController/);
     *       expect(content).toMatch(/Book Id\: Scarlet/);
     *     });
     *   </file>
     * </example>
     */

    /**
     * @ngdoc event
     * @name $route#$routeChangeStart
     * @eventType broadcast on root scope
     * @description
     * Broadcasted before a route change. At this  point the route services starts
     * resolving all of the dependencies needed for the route change to occur.
     * Typically this involves fetching the view template as well as any dependencies
     * defined in `resolve` route property. Once  all of the dependencies are resolved
     * `$routeChangeSuccess` is fired.
     *
     * @param {Object} angularEvent Synthetic event object.
     * @param {Route} next Future route information.
     * @param {Route} current Current route information.
     */

    /**
     * @ngdoc event
     * @name $route#$routeChangeSuccess
     * @eventType broadcast on root scope
     * @description
     * Broadcasted after a route dependencies are resolved.
     * {@link ngRoute.directive:ngView ngView} listens for the directive
     * to instantiate the controller and render the view.
     *
     * @param {Object} angularEvent Synthetic event object.
     * @param {Route} current Current route information.
     * @param {Route|Undefined} previous Previous route information, or undefined if current is
     * first route entered.
     */

    /**
     * @ngdoc event
     * @name $route#$routeChangeError
     * @eventType broadcast on root scope
     * @description
     * Broadcasted if any of the resolve promises are rejected.
     *
     * @param {Object} angularEvent Synthetic event object
     * @param {Route} current Current route information.
     * @param {Route} previous Previous route information.
     * @param {Route} rejection Rejection of the promise. Usually the error of the failed promise.
     */

    /**
     * @ngdoc event
     * @name $route#$routeUpdate
     * @eventType broadcast on root scope
     * @description
     *
     * The `reloadOnSearch` property has been set to false, and we are reusing the same
     * instance of the Controller.
     */

    var forceReload = false,
        $route = {
          routes: routes,

          /**
           * @ngdoc method
           * @name $route#reload
           *
           * @description
           * Causes `$route` service to reload the current route even if
           * {@link ng.$location $location} hasn't changed.
           *
           * As a result of that, {@link ngRoute.directive:ngView ngView}
           * creates new scope, reinstantiates the controller.
           */
          reload: function() {
            forceReload = true;
            $rootScope.$evalAsync(updateRoute);
          }
        };

    $rootScope.$on('$locationChangeSuccess', updateRoute);


    var actions = {
      'get': {method: "GET"},
      'put': {method: "PUT", autoData: true},
      'post': {method: "POST", autoData: true},
      'delete': {method: "DELETE"},
      'patch': {method: "PATCH"}
    }

    var isFunction = angular.isFunction,
      isString = angular.isString,
      noop = angular.noop;

    Resource.prototype.$process = function(body, id, headers){
      shallowClearAndCopy(body || {}, this);
      this.$link = headers ? parseLinks(headers("link"), body["@id"]) || {"$all": []}: {"$all": []};
      var self = this.$link.self = id || this["@id"];

      if(this.$members){
        angular.forEach(this.$members, function(member){
          member.$page = self;
          })
      }
    }

    Resource.prototype.$is = function(type){
      type = resolve(type);
      return $q.when(jsonld.promises().expand(this))
      .then(function(expanded){
        return expanded["@type"] && !!~expanded["@type"].indexOf(type);
      })
    }

    Resource.prototype.$expand = function(){
      return $q.when(jsonld.promises().expand(this));
    }

    Resource.prototype.$includes = function(url){
      return typeof this.$link.self == "string" ? this.$link.self.indexOf == url : this.$link.self.indexOf(url)
    }

    Resource.prototype.$include = function(rel, success, error){
      var value = this,
        dir = rel == "next";

      if(rel != "next" && rel != "prev") throw new Error("Invalid include relation, only 'next' and 'prev' is supported!")

      if(!this.$link[rel]) return this;

      value.$promise = this.$get(rel).$promise
      .then(function(response){

        value.$members = dir ? value.$members.concat(response.$members) : response.$members.concat(value.$members);
        value.$link[rel] = response.$link[rel];
        if( !angular.isArray(value.$link.self) ){
          value.$link.self = [value.$link.self]
        }
        value.$link.self.push(response.$link.self);

        value.$resolved = true;

        (success||noop)(value, response.headers);

      }, function(response){
        value.$resolved = true;

        (error||noop)(response);

        return $q.reject(response);
      })

      value.$resolved = false;
      return value;
    }

    angular.forEach(actions, function(action, name){
      Resource.prototype["$" + name] = function(a1, a2, a3, a4) {
        var params, data, success, error;

        /* jshint -W086 */ /* (purposefully fall through case statements) */
        switch(arguments.length) {
        case 4:
          error = a4;
          success = a3;
          //fallthrough
        case 3:
        case 2:
          if (isFunction(a2)) {
            if (isFunction(a1)) {
              success = a1;
              error = a2;
              break;
            }

            success = a2;
            error = a3;
            //fallthrough
          } else {
            params = a1;
            data = a2;
            success = a3;
            break;
          }
        case 1:
          if (isFunction(a1)) success = a1;
          else if (isString(a1) || a1.rel) params = a1;
          else data = a1;
          break;
        case 0: break;
        default:
          throw new Error("badargs, Expected up to 4 arguments [params, data, success, error], got "+arguments.length+" arguments");
        }

        if(!params) params = {rel: "self"};

        if(isString(params)) params = {rel: params};

        if(!data && action.autoData) data = this;

        var self = this,
          httpConfig,
          value = new Resource(),
          promise = $q.when(jsonld.promises().expand(this))

        .then(function(expanded){
          var resource = expanded[0];            
          httpConfig = {method: action.method, headers: {"Accept": "application/ld+json, application/json"}, params: __IEBUG_PARAMS__}
          if(!params.rel || params.rel == "self"){
            httpConfig.url = resource["@id"];
          }else{
            var predicate = resolve(params.rel),
              rel = resource[predicate] || self.$link[predicate] && [{"@id": self.$link[predicate]}];

            if(!rel)
              throw new Error("badrel, Relation '"+predicate+"' not found in the resource");

            httpConfig.url = rel[0]["@id"];
          }

          if(params.params){
            httpConfig.params = params.params;
          }

          if(params.headers){
            angular.extend(httpConfig.headers, params.headers);
          }

          if(data) httpConfig.data = data;
          return $http(httpConfig);
        })
        .then(function(response){
          // TODO: checking consistency
          var url = httpConfig.url, qs;
          if(qs = $.param(httpConfig.params)){
            url += ~url.indexOf("?") ?  "&" + qs : "?" + qs;
          }
          value.$process(response.data, resolveUrl(url), response.headers)
          value.$resolved = true;

          (success||noop)(value, response.headers);

          return value;
        }, function(response) {
          value.$resolved = true;

          (error||noop)(response);

          return $q.reject(response);
        })

        value.$resolved = false
        value.$promise = promise;

        return value;

      }
    })


    return $route;

    /////////////////////////////////////////////////////

    /**
     * @param on {string} current url
     * @param route {Object} route regexp to match the url against
     * @return {?Object}
     *
     * @description
     * Check if the route matches the current url.
     *
     * Inspired by match in
     * visionmedia/express/lib/router/router.js.
     */
    function switchRouteMatcher(on, route) {
      var keys = route.keys,
          params = {};

      if (!route.regexp) return null;

      var m = route.regexp.exec(on);
      if (!m) return null;

      for (var i = 1, len = m.length; i < len; ++i) {
        var key = keys[i - 1];

        var val = 'string' == typeof m[i]
              ? decodeURIComponent(m[i])
              : m[i];

        if (key && val) {
          params[key.name] = val;
        }
      }
      return params;
    }

    function updateRoute() {
      var next = parseRoute(),
          last = $route.current,
          response,
          resource;

      $rootScope.$broadcast('$routeUpdateRequest', next, last);

      if(!next){        
        next = $http({method: "GET", url: $location.url(), headers: {"Accept": "application/ld+json, application/json"}, params: __IEBUG_PARAMS__})
        .then(function(result){
          response = result;
          resource = result.data
          return jsonld.promises().expand(resource);
        })
        .then(function(result){
          var resTypes = result[0]["@type"],
            hash = $location.hash() || "";

          resource = new Resource(resource, $location.absUrl(), response.headers);

          resource.$resolved = true;

          if(!resTypes.length) resTypes = [resTypes];

          for(var i = 0; i <resTypes.length; i++){
            var t = resTypes[i], rr;
            if(types[t]){
              var route = types[t][hash] || types[t][""];
              var r = angular.copy(route);
              if(!r) continue;
              if(rr && rr.priority > r.priority) continue;
              r.$$route = route;
              r.type = t;
              r.types = resTypes;
              rr = r;
            }
          }
          if(rr){
            rr.params = $location.search();
          }else{
            //Fallback to otherwise if exists
            rr = routes[null] && inherit(routes[null], {params: {}, pathParams:{}});
          }
          return rr;
        })
        .catch(function(error){
          var route;

          resource = error.data;
          if(route = codes[error.status]){
            var r = angular.copy(route);
            r.$$route = route;
            return r;
          }
          throw error;
        })
      }


      $q.when(next).
        then(function(nxt) {
          next = nxt;

          if(!next){
            $rootScope.$broadcast('$routeChangeError', next, last, new Error("No route!"));
            return false;
          }
          next.response = response;

          if(!next.resolve) next.resolve = {};
          next.resolve.resource = function(){
            return resource;
          }

          if (next && last && next.$$route === last.$$route
              && angular.equals(next.pathParams, last.pathParams)
              && !next.reloadOnSearch && !forceReload) {
            last.params = next.params;
            angular.copy(last.params, $routeParams);
            last.type = next.type;
            last.types = next.types;
            $rootScope.$broadcast('$routeUpdate', last, resource);
          } else if (next || last) {
            forceReload = false;
            $rootScope.$broadcast('$routeChangeStart', next, last);
            $route.current = next;
            if (next) {
              if (next.redirectTo) {
                if (angular.isString(next.redirectTo)) {
                  $location.path(interpolate(next.redirectTo, next.params)).search(next.params)
                           .replace();
                } else {
                  $location.url(next.redirectTo(next.pathParams, $location.path(), $location.search()))
                           .replace();
                }
              }
            }
            if (next) {
              var locals = angular.extend({}, next.resolve),
                  template, templateUrl;

              angular.forEach(locals, function(value, key) {
                locals[key] = angular.isString(value) ?
                    $injector.get(value) : $injector.invoke(value);
              });

              if (angular.isDefined(template = next.template)) {
                if (angular.isFunction(template)) {
                  template = template(next.params);
                }
              } else if (angular.isDefined(templateUrl = next.templateUrl)) {
                if (angular.isFunction(templateUrl)) {
                  templateUrl = templateUrl(next.params);
                }
                templateUrl = $sce.getTrustedResourceUrl(templateUrl);
                if (angular.isDefined(templateUrl)) {
                  next.loadedTemplateUrl = templateUrl;
                  template = $http.get(templateUrl, {cache: $templateCache}).
                      then(function(response) { return response.data; });
                }
              }
              if (angular.isDefined(template)) {
                locals['$template'] = template;
              }
              return $q.all(locals)
              // after route change
              .then(function(locals) {
                if (next == $route.current) {
                  if (next) {
                    next.locals = locals;
                    angular.copy(next.params, $routeParams);
                  }
                  $rootScope.$broadcast('$routeChangeSuccess', next, last);
                }
              }, function(error) {
                if (next == $route.current) {
                  $rootScope.$broadcast('$routeChangeError', next, last, error);
                }
              });

            }
          }
      })
    }


    /**
     * @returns {Object} the current active route, by matching it against the URL
     */
    function parseRoute() {
      // Match a route
      var params, match;
      angular.forEach(routes, function(route, path) {
        if (!match && (params = switchRouteMatcher($location.path(), route))) {
          match = inherit(route, {
            params: angular.extend({}, $location.search(), params),
            pathParams: params});
          match.$$route = route;
        }
      });
      //No fallback
      return match;
      // No route matched; fallback to "otherwise" route
      return match || routes[null] && inherit(routes[null], {params: {}, pathParams:{}});
    }

    /**
     * @returns {string} interpolation of the redirect path with the parameters
     */
    function interpolate(string, params) {
      var result = [];
      angular.forEach((string||'').split(':'), function(segment, i) {
        if (i === 0) {
          result.push(segment);
        } else {
          var segmentMatch = segment.match(/(\w+)(.*)/);
          var key = segmentMatch[1];
          result.push(params[key]);
          result.push(segmentMatch[2] || '');
          delete params[key];
        }
      });
      return result.join('');
    }
  }];
}

ngRouteModule.provider('$routeParams', $RouteParamsProvider);


/**
 * @ngdoc service
 * @name $routeParams
 * @requires $route
 *
 * @description
 * The `$routeParams` service allows you to retrieve the current set of route parameters.
 *
 * Requires the {@link ngRoute `ngRoute`} module to be installed.
 *
 * The route parameters are a combination of {@link ng.$location `$location`}'s
 * {@link ng.$location#search `search()`} and {@link ng.$location#path `path()`}.
 * The `path` parameters are extracted when the {@link ngRoute.$route `$route`} path is matched.
 *
 * In case of parameter name collision, `path` params take precedence over `search` params.
 *
 * The service guarantees that the identity of the `$routeParams` object will remain unchanged
 * (but its properties will likely change) even when a route change occurs.
 *
 * Note that the `$routeParams` are only updated *after* a route change completes successfully.
 * This means that you cannot rely on `$routeParams` being correct in route resolve functions.
 * Instead you can use `$route.current.params` to access the new route's parameters.
 *
 * @example
 * ```js
 *  // Given:
 *  // URL: http://server.com/index.html#/Chapter/1/Section/2?search=moby
 *  // Route: /Chapter/:chapterId/Section/:sectionId
 *  //
 *  // Then
 *  $routeParams ==> {chapterId:1, sectionId:2, search:'moby'}
 * ```
 */
function $RouteParamsProvider() {
  this.$get = function() { return {}; };
}

ngRouteModule.directive('semaView', semauiViewFactory);
ngRouteModule.directive('semaView', semauiViewFillContentFactory);


/**
 * @ngdoc directive
 * @name ngView
 * @restrict ECA
 *
 * @description
 * # Overview
 * `ngView` is a directive that complements the {@link ngRoute.$route $route} service by
 * including the rendered template of the current route into the main layout (`index.html`) file.
 * Every time the current route changes, the included view changes with it according to the
 * configuration of the `$route` service.
 *
 * Requires the {@link ngRoute `ngRoute`} module to be installed.
 *
 * @animations
 * enter - animation is used to bring new content into the browser.
 * leave - animation is used to animate existing content away.
 *
 * The enter and leave animation occur concurrently.
 *
 * @scope
 * @priority 400
 * @param {string=} onload Expression to evaluate whenever the view updates.
 *
 * @param {string=} autoscroll Whether `ngView` should call {@link ng.$anchorScroll
 *                  $anchorScroll} to scroll the viewport after the view is updated.
 *
 *                  - If the attribute is not set, disable scrolling.
 *                  - If the attribute is set without value, enable scrolling.
 *                  - Otherwise enable scrolling only if the `autoscroll` attribute value evaluated
 *                    as an expression yields a truthy value.
 * @example
    <example name="ngView-directive" module="ngViewExample"
             deps="angular-route.js;angular-animate.js"
             animations="true" fixBase="true">
      <file name="index.html">
        <div ng-controller="MainCtrl as main">
          Choose:
          <a href="Book/Moby">Moby</a> |
          <a href="Book/Moby/ch/1">Moby: Ch1</a> |
          <a href="Book/Gatsby">Gatsby</a> |
          <a href="Book/Gatsby/ch/4?key=value">Gatsby: Ch4</a> |
          <a href="Book/Scarlet">Scarlet Letter</a><br/>

          <div class="view-animate-container">
            <div ng-view class="view-animate"></div>
          </div>
          <hr />

          <pre>$location.path() = {{main.$location.path()}}</pre>
          <pre>$route.current.templateUrl = {{main.$route.current.templateUrl}}</pre>
          <pre>$route.current.params = {{main.$route.current.params}}</pre>
          <pre>$route.current.scope.name = {{main.$route.current.scope.name}}</pre>
          <pre>$routeParams = {{main.$routeParams}}</pre>
        </div>
      </file>

      <file name="book.html">
        <div>
          controller: {{book.name}}<br />
          Book Id: {{book.params.bookId}}<br />
        </div>
      </file>

      <file name="chapter.html">
        <div>
          controller: {{chapter.name}}<br />
          Book Id: {{chapter.params.bookId}}<br />
          Chapter Id: {{chapter.params.chapterId}}
        </div>
      </file>

      <file name="animations.css">
        .view-animate-container {
          position:relative;
          height:100px!important;
          position:relative;
          background:white;
          border:1px solid black;
          height:40px;
          overflow:hidden;
        }

        .view-animate {
          padding:10px;
        }

        .view-animate.ng-enter, .view-animate.ng-leave {
          -webkit-transition:all cubic-bezier(0.250, 0.460, 0.450, 0.940) 1.5s;
          transition:all cubic-bezier(0.250, 0.460, 0.450, 0.940) 1.5s;

          display:block;
          width:100%;
          border-left:1px solid black;

          position:absolute;
          top:0;
          left:0;
          right:0;
          bottom:0;
          padding:10px;
        }

        .view-animate.ng-enter {
          left:100%;
        }
        .view-animate.ng-enter.ng-enter-active {
          left:0;
        }
        .view-animate.ng-leave.ng-leave-active {
          left:-100%;
        }
      </file>

      <file name="script.js">
        angular.module('ngViewExample', ['ngRoute', 'ngAnimate'])
          .config(['$routeProvider', '$locationProvider',
            function($routeProvider, $locationProvider) {
              $routeProvider
                .when('/Book/:bookId', {
                  templateUrl: 'book.html',
                  controller: 'BookCtrl',
                  controllerAs: 'book'
                })
                .when('/Book/:bookId/ch/:chapterId', {
                  templateUrl: 'chapter.html',
                  controller: 'ChapterCtrl',
                  controllerAs: 'chapter'
                });

              // configure html5 to get links working on jsfiddle
              $locationProvider.html5Mode(true);
          }])
          .controller('MainCtrl', ['$route', '$routeParams', '$location',
            function($route, $routeParams, $location) {
              this.$route = $route;
              this.$location = $location;
              this.$routeParams = $routeParams;
          }])
          .controller('BookCtrl', ['$routeParams', function($routeParams) {
            this.name = "BookCtrl";
            this.params = $routeParams;
          }])
          .controller('ChapterCtrl', ['$routeParams', function($routeParams) {
            this.name = "ChapterCtrl";
            this.params = $routeParams;
          }]);

      </file>

      <file name="protractor.js" type="protractor">
        it('should load and compile correct template', function() {
          element(by.linkText('Moby: Ch1')).click();
          var content = element(by.css('[ng-view]')).getText();
          expect(content).toMatch(/controller\: ChapterCtrl/);
          expect(content).toMatch(/Book Id\: Moby/);
          expect(content).toMatch(/Chapter Id\: 1/);

          element(by.partialLinkText('Scarlet')).click();

          content = element(by.css('[ng-view]')).getText();
          expect(content).toMatch(/controller\: BookCtrl/);
          expect(content).toMatch(/Book Id\: Scarlet/);
        });
      </file>
    </example>
 */


/**
 * @ngdoc event
 * @name ngView#$viewContentLoaded
 * @eventType emit on the current ngView scope
 * @description
 * Emitted every time the ngView content is reloaded.
 */
semauiViewFactory.$inject = ['$route', '$anchorScroll', '$animate'];
function semauiViewFactory(   $route,   $anchorScroll,   $animate) {
  return {
    restrict: 'ECA',
    terminal: true,
    priority: 400,
    transclude: 'element',
    link: function(scope, $element, attr, ctrl, $transclude) {
        var currentScope,
            currentElement,
            previousElement,
            autoScrollExp = attr.autoscroll,
            onloadExp = attr.onload || '';

        scope.$on('$routeChangeSuccess', update);
        update();

        function cleanupLastView() {
          if(previousElement) {
            previousElement.remove();
            previousElement = null;
          }
          if(currentScope) {
            currentScope.$destroy();
            currentScope = null;
          }
          if(currentElement) {
            $animate.leave(currentElement, function() {
              previousElement = null;
            });
            previousElement = currentElement;
            currentElement = null;
          }
        }

        function update() {
          var locals = $route.current && $route.current.locals,
              template = locals && locals.$template;

          if (angular.isDefined(template)) {
            var newScope = scope.$new();
            var current = $route.current;

            // Note: This will also link all children of ng-view that were contained in the original
            // html. If that content contains controllers, ... they could pollute/change the scope.
            // However, using ng-view on an element with additional content does not make sense...
            // Note: We can't remove them in the cloneAttchFn of $transclude as that
            // function is called before linking the content, which would apply child
            // directives to non existing elements.
            var clone = $transclude(newScope, function(clone) {
              $animate.enter(clone, null, currentElement || $element, function onNgViewEnter () {
                if (angular.isDefined(autoScrollExp)
                  && (!autoScrollExp || scope.$eval(autoScrollExp))) {
                  $anchorScroll();
                }
              });
              cleanupLastView();
            });

            currentElement = clone;
            currentScope = current.scope = newScope;
            currentScope.$emit('$viewContentLoaded');
            currentScope.$eval(onloadExp);
          } else {
            cleanupLastView();
          }
        }
    }
  };
}

// This directive is called during the $transclude call of the first `ngView` directive.
// It will replace and compile the content of the element with the loaded template.
// We need this directive so that the element content is already filled when
// the link function of another directive on the same element as ngView
// is called.
semauiViewFillContentFactory.$inject = ['$compile', '$controller', '$route'];
function semauiViewFillContentFactory($compile, $controller, $route) {
  return {
    restrict: 'ECA',
    priority: -400,
    link: function(scope, $element) {
      var current = $route.current,
          locals = current.locals;

      $element.html(locals.$template);

      var link = $compile($element.contents());

      if (current.controller) {
        locals.$scope = scope;
        var controller = $controller(current.controller, locals);
        if (current.controllerAs) {
          scope[current.controllerAs] = controller;
        }
        $element.data('$ngControllerController', controller);
        $element.children().data('$ngControllerController', controller);
      }

      link(scope);
    }
  };
}


})(window, window.angular);
