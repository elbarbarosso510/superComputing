function debug(msg) {
	document.getElementById('debug').innerText = msg;
}

function createElement(name,attrs) {
	var e = document.createElementNS('http://www.w3.org/2000/svg',name);
	for(var key in attrs) {
		e.setAttribute(key,attrs[key]);
	}
	return e;
}

function clamp(n,top) {
	return Math.min(top-1,Math.max(0,n));
}

function random(min,max) {
	return Math.floor(Math.random()*(max-min))+min;
}


function Player(id,name,colour) {
	this.id = id;
	this.name = name;
	this.colour = colour;
	this.make_html();
	this.show_score();
}
Player.prototype = {
	score: 0,
	
	make_html: function() {
		this.html = document.querySelector('#templates .player').cloneNode(true);
		this.html.classList.add(this.id);
		this.html.querySelector('.name').innerText = this.name;
		this.html.style['background-color'] = this.colour;
	},
	
	show_score: function() {
		this.html.querySelector('.score').innerText = this.score;
	}
}

function Game(size) {
	this.size = size;

	var oldgame = document.getElementById('game');
	if(oldgame) {
		oldgame.parentNode.removeChild(oldgame);
	}
	this.html = document.getElementById('game-template').cloneNode(true);
	this.html.setAttribute('id','game');
	document.body.insertBefore(this.html,document.getElementById('templates'));

	this.init_game();
	this.init_graphics();

	this.add_umpire_lines();
}
Game.prototype = {
	state: 'play',
	touchstate: '',
	turn_line: 0,
	turn_lines: 2,
	num_occupied: 0,
	
	init_game: function() {
		this.grid = [];
		for(var x=0;x<this.size;x++) {
			var row = [];
			for(var y=0;y<this.size;y++) {
				row.push({
					occupied: false,
				});
			}
			this.grid.push(row);
		}
		
		this.lines = [];
		
		this.umpire = new Player('umpire','Umpire','#444');

		this.players = [];
		this.add_player(new Player('player-a','Player A','orange'));
		this.add_player(new Player('player-b','Player B','#1047a9'));

		this.player_index = 0;
		this.set_current_player(this.players[this.player_index]);
	},
	
	add_player: function(player) {
		this.players.push(player);
		this.html.querySelector('.scores').appendChild(player.html);
	},
	
	init_graphics: function() {
		var g = this;
		
		this.svg = this.html.querySelector('.board');

		
		this.svg.setAttribute('viewBox','0 0 '+this.size+' '+this.size);
		for(var x=0;x<this.size;x++) {
			for(var y=0;y<this.size;y++) {
				var square = createElement('rect',{class:'square', x: x+0.02, y: y+0.02, width: 0.96, height: 0.96});
				this.svg.querySelector('.grid').appendChild(square);
				this.grid[x][y].svg = square;
			}
		}
		
		this.svg.addEventListener('mousedown',function(e) {
			g.touchstart(g.invert_pos(e.clientX,e.clientY));
		});
		this.svg.addEventListener('mousemove',function(e) {
			if(g.touchstate=='drag') {
				g.touchmove(g.invert_pos(e.clientX,e.clientY));
			}
		})
		this.svg.addEventListener('mouseup',function(e) {
			if(g.touchstate=='drag') {
				g.touchend();
			}
		})
		this.svg.addEventListener('touchstart',function(e) {
			g.touchstart(g.invert_pos(e.touches[0].clientX,e.touches[0].clientY));
			e.preventDefault();
		});
		this.svg.addEventListener('touchmove',function(e) {
			g.touchmove(g.invert_pos(e.touches[0].clientX,e.touches[0].clientY));
			e.preventDefault();
		});
		document.body.addEventListener('touchend',function(e) {
			g.touchend();
			if(g.touchstate=='drag') {
				e.preventDefault();
			}
		});
		this.html.querySelector('.place').addEventListener('click',function(e) {
			g.place();
		});
		
		this.html.querySelector('.reset').addEventListener('click',function(e) {
			game = new Game(size);
		});
	},

	add_umpire_lines: function() {
		for(var i=0;i<2;i++) {
			var l = new Line(this,this.umpire);
			while(true) {
				var a1 = random(0,this.size);
				var a2 = random(0,this.size);
				var b = random(0,this.size);
				if(Math.random()<0.5) {
					l.set_pos(a1,b,a2,b);
				} else {
					l.set_pos(b,a1,b,a2);
				}
				if(!this.check_overlap(l)) {
					break;
				}
			}
			this.add_line(l);
		}
	},
	
	invert_pos: function(x,y) {
		var r = this.svg.getBoundingClientRect();
		x -= r.left;
		y -= r.top;
		x = Math.floor(x/this.svg.clientWidth * this.size);
		y = Math.floor(y/this.svg.clientHeight * this.size);
		x = clamp(x,this.size);
		y = clamp(y,this.size);
		return {x:x, y:y};
	},
		
	touchstart: function(pos) {
		if(this.state=='play' || this.state=='placed') {
			this.touchstate = 'drag';
			this.state = 'drag';
			if(!this.current_line) {
				this.current_line = new Line(this,this.current_player);
			}
			var line = this.current_line
			this.dragpos = pos;
			line.set_pos(pos.x,pos.y,pos.x,pos.y);
			this.svg.appendChild(line.svg);
			line.svg.classList.add('pulse');
		}
	},
	
	touchmove: function(pos) {
		if(this.state=='drag') {
			var g = this;
			var line = this.current_line;
			
			var dx = pos.x-this.dragpos.x;
			var dy = pos.y-this.dragpos.y;
			if(Math.abs(dx)>Math.abs(dy)) {
				pos.y = this.dragpos.y;
			} else {
				pos.x = this.dragpos.x;
			}

			line.set_pos(this.dragpos.x,this.dragpos.y,pos.x,pos.y);
			
			this.overlap = this.check_overlap(line);
			line.svg.classList.toggle('overlap',this.overlap);
			
			this.calculate_score();
		}
	},
	
	touchend: function() {
		if(this.touchstate=='drag') {
			this.touchstate = ''
			this.state = 'placed';
			var place_button = this.html.querySelector('.place');
			if(!this.check_overlap(this.current_line)) {
				place_button.classList.add('pulse');
				place_button.removeAttribute('disabled');
				place_button.style['background-color'] = this.current_player.colour;
			} else {
				place_button.classList.remove('pulse');
				place_button.setAttribute('disabled','');
			}
		}
	},
	
	set_current_player: function(player) {
		if(this.current_player) {
			this.html.querySelector('.player.'+this.current_player.id).classList.remove('current');
		}
		this.current_player = player;
		this.html.querySelector('.player.'+this.current_player.id).classList.add('current');
	},
	
	place: function() {
		if(this.state=='placed' && !this.overlap) {
			var place_button = this.html.querySelector('.place');
			place_button.classList.remove('pulse');
			place_button.setAttribute('disabled','');

			this.calculate_score();
			this.score(this.possible_score,this.current_player);

			this.add_line(this.current_line);

			this.current_line = null;

			if(this.num_occupied >= this.size*this.size) {
				this.end();
			} else {
				this.next_turn();
			}
		}
	},

	check_overlap: function(line) {
		var g = this;
		var overlap = false;
		line.squares().forEach(function(p) {
			if(g.occupied(p.x,p.y)) {
				overlap = true;
			}
		});
		return overlap;
	},
	
	add_line: function(line) {
		var g = this;
		
		this.lines.push(line);

		line.svg.classList.remove('pulse');
		
		this.svg.querySelector('.lines').appendChild(line.svg);
		line.svg.classList.add('placed');

		line.squares().forEach(function(p) {
			g.occupy(p.x,p.y,line);
		});		

	},
	
	calculate_score: function() {
		var g = this;
		var line = this.current_line;

		var scorers = [];
		
		var l1,l2;
		switch(line.direction) {
			case 'horizontal':
				if(g.occupied(line.x1-1,line.y1) && g.occupied(line.x2+1,line.y1)) {
					l1 = g.grid[line.x1-1][line.y1].line;
					l2 = g.grid[line.x2+1][line.y1].line;
				}
				break;
			case 'vertical':
				if(g.occupied(line.x1,line.y1-1) && g.occupied(line.x1,line.y2+1)) {
					l1 = g.grid[line.x1][line.y1-1].line;
					l2 = g.grid[line.x1][line.y2+1].line;
				}
				break;
		}
		if(l1!==undefined) {
			scorers.push({score: Math.abs(l1.length-l2.length)*(line.length+1)});
		}
		
		var total = 0;
		scorers.forEach(function(s){ total += s.score; });
		var score = scorers.length*total;
		this.possible_score = score;
		
		var possible_score_html = this.html.querySelector('.possible-score');
		possible_score_html.classList.toggle('show',score>0);
		possible_score_html.innerText = score;
	},
	
	occupy: function(x,y,line) {
		if(this.grid[x][y].occupied) {
			console.log(x,y,'occupied');
		}
		this.grid[x][y].occupied = true;
		this.grid[x][y].line = line;
		this.grid[x][y].svg.classList.add('occupied');
		this.num_occupied += 1;
	},

	occupied: function(x,y) {
		return x>=0 && x<this.size && y>=0 && y<this.size && this.grid[x][y].occupied;
	},
	
	score: function(points,player) {
		player.score += points;
		player.show_score();
		this.html.querySelector('.possible-score').classList.remove('show');
	},
	
	next_turn: function() {
		this.turn_line += 1;
		if(this.turn_line>=this.turn_lines) {
			this.turn_line = 0;
			this.player_index = (this.player_index+1) % this.players.length;
			this.set_current_player(this.players[this.player_index]);
		}
		this.state = 'play';
	},

	end: function() {
		this.state = 'end';

		var p0 = this.players[0];
		var p1 = this.players[1];
		var winner = this.winner = p0.score > p1.score ? p0 : p1.score > p0.score ? p1 : null;

		var win = this.html.querySelector('.win');
		win.classList.add('show');
		if(winner===null) {
			win.innerText = 'Draw';
		} else {
			win.innerText = winner.name+' wins!';
			win.style['background-color'] = winner.colour;
		}
	}
}

function Line(game,player) {
	this.game = game;
	this.player = player;
	this.make_svg();
}
Line.prototype = {
	length: 0,
	
	make_svg: function() {
		var p = createElement('path',{class:'line'})
		p.style['fill'] = this.player.colour;//'url(#pattern-'+this.player.id+')';
		this.svg = p;
		return this.svg;
	},
	set_pos: function(x1,y1,x2,y2) {
		var g = this.game;
		var size = this.game.size;
		x1 = clamp(x1,size);
		y1 = clamp(y1,size);
		x2 = clamp(x2,size);
		y2 = clamp(y2,size);
		this.x1 = x1;
		this.y1 = y1;
		this.x2 = x2;
		this.y2 = y2;
		
		this.direction = x1==x2 ? y1==y2 ? 'none': 'vertical' : 'horizontal';
		
		var d;
		if(this.direction=='horizontal') {
			this.x1 = Math.min(x1,x2);
			this.x2 = Math.max(x1,x2);
			this.length = this.x2-this.x1;

			var connect = g.occupied(this.x1-1,this.y1) && g.occupied(this.x2+1,this.y1);
			d = 'M '+(this.x1+0.5)+' '+(this.y1+0.9);
			if(connect) {
				d += ' a 0.4,0.4 0 0 1 -0.4,-0.3 L '+(this.x1-0.2)+' '+(this.y1+0.6)+' a 0.1,0.1 0 0 1 0,-0.2 L '+(this.x1+0.1)+' '+(this.y1+0.4)+' a 0.4,0.4 0 0 1 0.4,-0.3';
			} else {
				d += ' a 0.4,0.4 0 0 1 0,-0.8';
			}
			d +=' L '+(this.x2+0.5)+' '+(this.y2+0.1);
			if(connect) {
				d += ' a 0.4,0.4 0 0 1 0.4,0.3 L '+(this.x2+1.2)+' '+(this.y1+0.4)+' a 0.1,0.1 0 0 1 0,0.2 L '+(this.x2+0.9)+' '+(this.y1+0.6)+' a 0.4,0.4 0 0 1 -0.4,0.3';
			} else {
				d += ' a 0.4,0.4 0 0 1 0,0.8';
			}
			d+=' z';
		} else if(this.direction=='vertical') {
			this.y1 = Math.min(y1,y2);
			this.y2 = Math.max(y1,y2);
			this.length = this.y2-this.y1;

			var connect = g.occupied(this.x1,this.y1-1) && g.occupied(this.x1,this.y2+1);
			d = 'M '+(this.x1+0.1)+' '+(this.y1+0.5);
			if(connect) {
				d += ' a 0.4,0.4 0 0 1 0.3,-0.4 L '+(this.x1+0.4)+' '+(this.y1-0.2)+' a 0.1,0.1 0 0 1 0.2,0 L '+(this.x1+0.6)+' '+(this.y1+0.1)+' a 0.4,0.4 0 0 1 0.3,0.4';
			} else {
				d += ' a 0.4,0.4 0 0 1 0.8,0';
			}
			d +=' L '+(this.x1+0.9)+' '+(this.y2+0.5);
			if(connect) {
//				d += ' a 0.4,0.4 0 0 1 -0.4,0.3 L '+(this.x2+1.2)+' '+(this.y1+0.4)+' a 0.1,0.1 0 0 1 0,0.2 L '+(this.x2+0.9)+' '+(this.y1+0.6)+' a 0.4,0.4 0 0 1 -0.4,0.3';
				d += ' a 0.4,0.4 0 0 1 -0.3,0.4 L '+(this.x1+0.6)+' '+(this.y2+1.2)+' a 0.1,0.1 0 0 1 -0.2,0 L '+(this.x1+0.4)+' '+(this.y2+0.9)+' a 0.4,0.4 0 0 1 -0.3,-0.4';
			} else {
				d += ' a 0.4,0.4 0 0 1 -0.8,0';
			}
			d+=' z';
		} else {
			this.length = 0;
			d = 'M '+(this.x1+0.1)+' '+(this.y1+0.5)+' a 0.4,0.4 0 0 1 0.8,0 a 0.4,0.4 0 0 1 -0.8,0 z';
		}
		this.svg.setAttribute('d',d);
	},
	
	squares: function() {
		var x = this.x1;
		var y = this.y1;
		var dx = Math.sign(this.x2-this.x1);
		var dy = Math.sign(this.y2-this.y1);
		var out = [];
		for(var i=0;i<=this.length;i++) {
			out.push({x:x,y:y});
			x += dx;
			y += dy;
		}
		return out;
	}
}

var size = 7;
var game;
window.addEventListener('load',function() {
	game = new Game(size);
});

var owidth = null;
function resize() {
	if(window.innerWidth==owidth) {
		return;
	}
	owidth = window.innerWidth;
	var w = Math.min(window.innerWidth,window.innerHeight);
	var size;
	var big_size = 24;
	var w_rems = 24;
	if(w>=big_size*w_rems) {
		size = big_size;
	} else {
		size = (w/w_rems);
	}
	document.querySelector('html').style['font-size'] = size+'px';
}
window.addEventListener('resize',resize);
resize();
