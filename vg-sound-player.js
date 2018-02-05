/* global $ */
var settings = {
  
  RING_BG_WIDTH       : 1,
  RING_BG_COLOR       : "#999",
  
  RING_PROGRESS_WIDTH : 3,
  RING_PROGRESS_COLOR : "#b24d49",
  
  TICK_COLOR          : "#999",
  TICK_WIDTH          : 1,
  TICK_LENGTH         : 15,
  
  TIME_LABEL_DIST     : 5,
  SEEK_PADDING        : 20, // space around the ring that will pick up a click
  
  FRAMERATE           : 60
  
};

$(function(){
  "use strict";

  function init(){
    $("[data-vg-sound-player]").each(function(){
      var player = new SoundPlayer( this );
    });
  }

  function toValidRatio( progress, total ){
    if( total === 0 ){
      return 0;
    }
    return Math.min( 1, Math.max( 0, progress/total ) );
  }

  function validScalarFromRatio( ratio, total ){
    return Math.min( total, Math.max( 0, ratio * total ) );
  }

  function clear( context ){
    context.clearRect( 0, 0, context.canvas.width, context.canvas.height );
  }

  function arc( context, centerX, centerY, diameter, ratio, width, color ){
    var centerDiameter = diameter - (2*width);
    var radius = centerDiameter/2;
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    context.arc( centerX, centerY, radius, 1.5*Math.PI, (1.5+(2*ratio))*Math.PI , false );
    context.stroke();
  }

  function coordsFromCircle( centerX, centerY, radius, ratio ){
    var radians = ratio * 2 * Math.PI;
    var x = centerX + ( ( centerY - radius ) - centerY ) * Math.sin( -1*radians );
    var y = centerY + ( ( centerY - radius ) - centerY ) * Math.cos( -1*radians );
    return [ x, y ];
  }

  function timeString( time ){
    var minutes = Math.floor( time / 60 );
    var seconds = Math.floor( time % 60 );
    if( seconds < 10 ){
      seconds = "0" + seconds;
    }
    return minutes + ":" + seconds;
  }

  function parseTemplate( scope, template ){
    Object.keys( scope ).forEach( function( key ){
      var toReplace = "{{ " + key + " }}";
      if( template.indexOf( toReplace ) >= 0 ){
        template = template.split( toReplace ).join( scope[ key ] );
      }
    } );
    return template;
  }

  var SoundPlayer = function( element ){
    
    this.element = element;
    try{
      this.tracks = JSON.parse( $(this.element).attr("data-vg-sound-player").replace(/'/g, "\"") );
    }catch(e){
      console.log( e );
      this.tracks = [ 
        { 
          url : $(this.element).attr("data-vg-sound-player"), 
          name : $(element).attr("data-vg-title") 
        }
      ];
    }

    this.loadTrack( 0 );
    
    this.diameter = $(element).innerWidth();
    $(element).css("height", this.diameter+"px");

    this.updateSize();
    
    $(window).resize(function(){
      this.updateSize();
    }.bind(this));

  };

  SoundPlayer.prototype = {

    RING_BG_WIDTH       : settings.RING_BG_WIDTH,
    RING_BG_COLOR       : settings.RING_BG_COLOR,

    RING_PROGRESS_WIDTH : settings.RING_PROGRESS_WIDTH,
    RING_PROGRESS_COLOR : settings.RING_PROGRESS_COLOR,

    TICK_COLOR          : settings.TICK_COLOR,
    TICK_WIDTH          : settings.TICK_WIDTH,
    TICK_LENGTH         : settings.TICK_LENGTH,

    TIME_LABEL_DIST     : settings.TIME_LABEL_DIST,

    SEEK_PADDING        : settings.SEEK_PADDING,
    
    FRAMERATE           : settings.FRAMERATE,

    HEX_SVG : '<svg class="hex" width="90px" height="100px" viewBox="0 0 90 100" version="1.1"><polygon points="45 2 87 26.75 87 73.25 45 98 3 73.25 3 26.75 "></polygon></svg>',
    PLAY_SVG : '<svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1"><path d="M7.21268003,7.34262359 L32.9763519,7.34262359 C33.7797373,7.34262359 34.6003873,8.79694717 34.2073269,9.52410896 L21.3053698,33.3927295 C20.7252741,34.4659067 19.7609754,33.9353881 19.4482091,33.3567703 C15.1279224,25.36424 10.8076358,17.3717097 6.48734914,9.37917941 C6.12040214,8.70032747 6.60395607,7.34262359 7.21268003,7.34262359 Z" transform="translate(22.334442, 20.677066) rotate(-90.000000) translate(-20.334442, -20.677066) "></path></svg>',
    PAUSE_SVG : '<svg width="40px" height="40px" viewBox="0 0 40 40" version="1.1"><path d="M9,33.0352783 L9,7.99414062 C9,7.32942708 10.3549805,6 11.0324707,6 L16.0611572,6 C16.3741048,6 18,7.31583659 18,7.97375488 L18,32.9890137 C18,33.6593424 16.7148438,35 16.0722656,35 L11.0841064,35 C10.3894043,35 9,33.6901855 9,33.0352783 Z"></path><path d="M22,33.0352783 L22,7.99414062 C22,7.32942708 23.3549805,6 24.0324707,6 L29.0611572,6 C29.3741048,6 31,7.31583659 31,7.97375488 L31,32.9890137 C31,33.6593424 29.7148438,35 29.0722656,35 L24.0841064,35 C23.3894043,35 22,33.6901855 22,33.0352783 Z"></path></svg>',
    FAST_FORWARD_SVG : '<svg width="66px" height="40px" viewBox="0 0 66 40" version="1.1"><path d="M7.21268003,7.34262359 L32.9763519,7.34262359 C33.7797373,7.34262359 34.6003873,8.79694717 34.2073269,9.52410896 L21.3053698,33.3927295 C20.7252741,34.4659067 19.7609754,33.9353881 19.4482091,33.3567703 C15.1279224,25.36424 10.8076358,17.3717097 6.48734914,9.37917941 C6.12040214,8.70032747 6.60395607,7.34262359 7.21268003,7.34262359 Z" transform="translate(20.334442, 20.677066) rotate(-90.000000) translate(-20.334442, -20.677066) "></path><path d="M34.21268,7.34262359 L59.9763519,7.34262359 C60.7797373,7.34262359 61.6003873,8.79694717 61.2073269,9.52410896 L48.3053698,33.3927295 C47.7252741,34.4659067 46.7609754,33.9353881 46.4482091,33.3567703 C42.1279224,25.36424 37.8076358,17.3717097 33.4873491,9.37917941 C33.1204021,8.70032747 33.6039561,7.34262359 34.21268,7.34262359 Z" transform="translate(47.334442, 20.677066) rotate(-90.000000) translate(-47.334442, -20.677066) "></path></svg>',
    REWIND_SVG : '<svg width="66px" height="40px" viewBox="0 0 66 40" version="1.1"><path d="M5.51267927,7.34262359 L31.2763511,7.34262359 C32.0797366,7.34262359 32.9003865,8.79694717 32.5073261,9.52410896 L19.6053691,33.3927295 C19.0252733,34.4659067 18.0609747,33.9353881 17.7482083,33.3567703 C13.4279217,25.36424 9.10763502,17.3717097 4.78734837,9.37917941 C4.42040138,8.70032747 4.90395531,7.34262359 5.51267927,7.34262359 Z" transform="translate(18.634442, 20.677066) rotate(-270.000000) translate(-18.634442, -20.677066) "></path><path d="M32.5126793,7.34262359 L58.2763511,7.34262359 C59.0797366,7.34262359 59.9003865,8.79694717 59.5073261,9.52410896 L46.6053691,33.3927295 C46.0252733,34.4659067 45.0609747,33.9353881 44.7482083,33.3567703 C40.4279217,25.36424 36.107635,17.3717097 31.7873484,9.37917941 C31.4204014,8.70032747 31.9039553,7.34262359 32.5126793,7.34262359 Z" transform="translate(45.634442, 20.677066) rotate(-270.000000) translate(-45.634442, -20.677066) "></path></svg>',

    elements : {
      hex : {
        template : "{{ HEX_SVG }}"
      },
      playButton : {
        template : "<button class='play'></button>",
        listeners : {
          "click" : function( SoundPlayer ){
            return function(){
              if( SoundPlayer.audioElement.paused ){
                SoundPlayer.play();
              }else{
                SoundPlayer.pause();
              }
            };
          }
        }
      },
      nextButton : {
        template : "<button class='next'>{{ FAST_FORWARD_SVG }}</button>",
        listeners : {
          "click" : function( SoundPlayer ){
            return function(){
              SoundPlayer.next();
            };
          }
        }
      },
      prevButton : {
        template : "<button class='prev'>{{ REWIND_SVG }}</button>",
        listeners : {
          "click" : function( SoundPlayer ){
            return function(){
              SoundPlayer.prev();
            };
          }
        }
      },
      audioElement : {
        template : "<audio src='{{ currentTrackURL }}'></audio>",
        listeners : {
          "ended" : function( SoundPlayer ){
            return function(){
              SoundPlayer.seek(0);
              SoundPlayer.pause();
              SoundPlayer.audioElement.load();
              var indexBefore = SoundPlayer.currentTrackIndex;
              SoundPlayer.next();
              var indexAfter = SoundPlayer.currentTrackIndex;
              if( indexBefore !== indexAfter ){
                SoundPlayer.audioElement.oncanplaythrough = SoundPlayer.play.bind( SoundPlayer );
              }
            };
          }
        }
      },
      trackNameLabel : {
        template : "<h3>{{ currentTrackName }}</h3>"
      },
      timeLabel : {
        template : "<span class='vg-time-label'></span>"
      },
      canvas : {
        template : "<canvas width='{{ diameter }}' height='{{ diameter }}'></canvas>"
      }
    },

    get radius(){
      return this.diameter / 2;
    },

    next : function(){
      this.currentTrackIndex = Math.min( this.tracks.length - 1, this.currentTrackIndex + 1 );
      this.loadTrack( this.currentTrackIndex );
    },

    prev : function(){
      this.currentTrackIndex = Math.max( 0,this.currentTrackIndex - 1 );
      this.loadTrack(this.currentTrackIndex );
    },

    loadTrack : function( trackIndex ){
      this.currentTrack = this.tracks[ trackIndex ];
      this.currentTrackURL = this.currentTrack.url;
      this.currentTrackName = this.currentTrack.name || this.currentTrack.url;
      this.currentTrackIndex = trackIndex;
      this.buildElement();
    },

    getPlaybackRatio : function(){
      if( this.audioElement == null ){
        return 0; 
      }else{
        return toValidRatio( this.audioElement.currentTime, this.audioElement.duration );
      }
    },

    updateSize : function(){
      this.diameter = $(this.element).innerWidth();
      this.canvas.width = this.diameter;
      this.canvas.height = this.diameter;
      $(this.element).css("height", this.diameter+"px");
      this.draw();
    },

    buildElement : function(){
      this.buildContent();
      $(this.element)
        .empty()
        .append( $(this.hex) )
        .append( $(this.canvas) )
        .append( $(this.audioElement) )
        .append( $(this.timeLabel) )
        .append( $(this.nextButton) )
        .append( $(this.prevButton) )
        .append( $(this.playButton) );
      if( this.currentTrackName != null ){
        $(this.element).append( this.trackNameLabel );
      }
      if( this.currentTrackIndex === this.tracks.length - 1 ){
        $(this.nextButton).addClass("shaded");
      }
      if( this.currentTrackIndex === 0 ){
        $(this.prevButton).addClass("shaded");
      }
      this.bindSeekEvent();
      this.context = this.canvas.getContext("2d");
      this.seek(0);
      this.pause();
    },

    buildContent : function(){
      var templateScope = $.extend( {}, this, this.prototype );
      Object.keys( this.elements ).forEach( function( elementName ){
        var elementDefinition = this.elements[ elementName ];
        var html = parseTemplate(  templateScope, elementDefinition.template );
        this[ elementName ] = $( html )[0];
        if( elementDefinition.listeners != null ){
          Object.keys( elementDefinition.listeners ).forEach( function( eventName ){
            var boundCallback = elementDefinition.listeners[ eventName ]( this );
            $(this[ elementName ]).on( eventName, boundCallback );
          }.bind(this));
        }
      }.bind(this));
    },

    bindSeekEvent : function(){
      $(this.element)
        .on("mousedown", function(event){
          var playerRelativeX = event.pageX - $(this.element).offset().left;
          var playerRelativeY = event.pageY - $(this.element).offset().top;
          if( this.coordsCloseToRim( playerRelativeX, playerRelativeY ) ){
            this.seekByCoords( playerRelativeX, playerRelativeY );
            $(document)
              .on("mousemove", function( event ){
                var playerRelativeX = event.pageX - $(this.element).offset().left;
                var playerRelativeY = event.pageY - $(this.element).offset().top;
                this.seekByCoords( playerRelativeX, playerRelativeY );
              }.bind(this))
              .on("mouseup", function(){
                $(document).off("mousemove");
              });
          }
      }.bind(this));
    },

    seekByCoords : function( x, y ){
      var ratio = this.getProgressAtCoords( x, y );
      var time = validScalarFromRatio( ratio, this.audioElement.duration );
      this.seek( time );
    },

    getProgressAtCoords : function( x, y ){
      var dx = x - this.diameter/2;
      var dy = y - this.diameter/2;
      return ( 1.75 + 0.5 + ( Math.atan2(dy, dx) / ( Math.PI*2 ) ) ) % 1; 
    },

    coordsCloseToRim : function( x, y ){
      var distanceFromRim = Math.abs( 
        Math.sqrt( 
          Math.pow( x - ( this.diameter / 2 ), 2 ) 
          + 
          Math.pow( y - ( this.diameter / 2 ), 2 ) 
        ) 
        - 
        this.diameter/2 
      );
      return distanceFromRim < this.SEEK_PADDING;
    },
    
    play : function(){
      $(this.element).addClass("playing");
      this.audioElement.play();
      this.startAnimation();
      $( this.playButton ).html( this.PAUSE_SVG );
    },

    pause : function(){
      $(this.element).removeClass("playing");
      this.audioElement.pause();
      this.stopAnimation();
      $( this.playButton ).html( this.PLAY_SVG );
    },

    seek : function( seconds ){
      this.audioElement.currentTime = seconds;
      this.draw();
    },

    startAnimation : function(){
      this.stopAnimation();
      this.animationInterval = setInterval( 
        this.draw.bind(this),
        1000/this.FRAMERATE 
      );
    },

    stopAnimation : function(){
      if( this.animationInterval != null ){
        clearInterval( this.animationInterval );
      }
      this.draw();
    },

    draw : function(){
      this.clear();
      this.drawRim();
      if( isNaN( this.audioElement.duration ) || this.audioElement.duration == null ){
        this.clearTimeLabel();
        return;
      }

      if( !this.audioElement.paused ){
        this.drawProgress();
      }
      this.drawTick();
      this.drawTimeLabel();
    },

    clear : function(){
      clear( this.context );
    },

    drawRim : function(){
      arc( 
        this.context, 
        this.radius,
        this.radius,
        this.diameter - 2*( this.RING_PROGRESS_WIDTH - this.RING_BG_WIDTH ), 
        1, 
        this.RING_BG_WIDTH, 
        this.RING_BG_COLOR 
      );
    },

    drawProgress : function(){
      arc( 
        this.context, 
        this.radius,
        this.radius,
        this.diameter, 
        this.getPlaybackRatio(), 
        this.RING_PROGRESS_WIDTH, 
        this.RING_PROGRESS_COLOR 
      );
    },

    clearTimeLabel : function(){
      $( this.timeLabel ).text("");
    },

    drawTick : function(){
      var tickOuterCoords = coordsFromCircle( 
        this.radius, 
        this.radius, 
        this.radius - this.RING_PROGRESS_WIDTH, 
        this.getPlaybackRatio() 
      );
      var tickInnerCoords = coordsFromCircle( 
        this.radius, 
        this.radius, 
        this.radius - ( this.RING_PROGRESS_WIDTH + this.TICK_LENGTH ), 
        this.getPlaybackRatio() 
      );
      this.context.lineWidth = this.TICK_WIDTH;
      this.context.strokeStyle = this.TICK_COLOR;
      this.context.beginPath();
      this.context.moveTo.apply( this.context, tickOuterCoords );
      this.context.lineTo.apply( this.context, tickInnerCoords );
      this.context.stroke();
    },

    drawTimeLabel : function(){

      var timeLabel = $(this.timeLabel);
      var playbackRatio = this.getPlaybackRatio();

      var timeLabelCenterCoords = coordsFromCircle( 
        this.radius, 
        this.radius, 
        this.radius - ( this.RING_PROGRESS_WIDTH + this.TICK_LENGTH + this.TIME_LABEL_DIST ), 
        playbackRatio 
      );

      timeLabel.text( timeString( this.audioElement.currentTime ) );

      var timeLabelXoffset = 0;
      var timeLabelYoffset = 0;

      if( playbackRatio < 0.25 ){
        timeLabelXoffset = -1 * (         0.5 * ( playbackRatio / 0.25 ) );
        timeLabelYoffset =        0.5 - ( 0.5 * ( playbackRatio / 0.25 ) );
      }else if( playbackRatio < 0.5 ){
        timeLabelXoffset = -1 * ( 0.5 - ( 0.5 * ( ( playbackRatio - 0.25 ) / 0.25 ) ) );
        timeLabelYoffset = -1 * (         0.5 * ( ( playbackRatio - 0.25 ) / 0.25 ) );
      }else if( playbackRatio < 0.75 ){
        timeLabelXoffset =                0.5 * ( ( playbackRatio - 0.5 ) / 0.25 );
        timeLabelYoffset = -1 * ( 0.5 - ( 0.5 * ( ( playbackRatio - 0.5 ) / 0.25 ) ) );
      }else if( playbackRatio <= 1 ){
        timeLabelXoffset = 0.5 - ( 0.5 * ( ( playbackRatio - 0.75 ) / 0.25 ) );
        timeLabelYoffset =         0.5 * ( ( playbackRatio - 0.75 ) / 0.25 );
      }

      timeLabelXoffset -= 0.5;
      timeLabelXoffset *= 1.05;
      timeLabelXoffset += 0.5;

      var timeLabelX = ( 
        (
          timeLabelCenterCoords[0] 
          - 
          ( timeLabel.width() / 2 ) 
        )
        +
        ( timeLabelXoffset * timeLabel.width() )
      );

      var timeLabelY = ( 
        (
          timeLabelCenterCoords[1] 
          - 
          ( timeLabel.height() / 2 ) 
        )
        +
        ( timeLabelYoffset * timeLabel.height() )
      );

      timeLabel.css({
        "transform" : "translate("
          + timeLabelX + "px, "
          + timeLabelY + "px"
          + ")"
      });

    }
  
  };

  init();
  
});