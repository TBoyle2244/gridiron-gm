/* ---------- Help: the game manual ----------
   Each section: id, title, tab (the screen it explains, for the "?" shortcut), body (HTML). */
const HELP = [
{ id: 'career', title: 'Player career mode', body: `
<p>In a player career you are one player instead of the general manager. Every team, yours included, is run by the computer: you don't set the depth chart, make trades or sign anyone. You decide where you sign, how you train, when you ask for more, and when you retire. Switch between <b>General manager</b> and <b>Player career</b> at the top of the first screen or on the Data tab. Each keeps its own save.</p>
<ol>
<li><b>Pick a draft year</b> (1971 to 2027). The season before it plays out (a few seconds), then the draft opens with you in it.</li>
<li><b>Create a player</b>: name, position, height, weight, college, hometown and number, then answer the questions. The first, where the scouts have you, is the difficulty: it sets your talent and draft stock. The rest are trade-offs (built like a tank: better now, lower ceiling). The scouting report at the bottom shows your numbers before the dice.</li>
<li>Or <b>be a real prospect</b> from that year's class. With Real careers on, his ratings follow the career he really had, but you decide where he plays and when he retires. Teams won't necessarily draft him where he really went.</li>
<li><b>Draft day.</b> Teams draft on the grade they see; a team that worked you out sees your real ceiling. You can go undrafted and pick a camp invitation.</li>
<li><b>Summer.</b> Pick a training focus (★ marks the ones that fit your position) and how hard to work, then go to camp. Your growth or decline for your age happens there. Extra work grows you faster and raises the injury risk.</li>
<li><b>The season.</b> Play one game at a time or sim to the playoffs. Your line from every game is on the <b>Games</b> tab. Your team is on the <b>Team</b> tab.</li>
</ol>
<p><b>Contracts.</b> When your deal is up, your agent brings offers: your team's (if it still wants you) and others with the money, years, the role you'd have and last season's record. Before 1993 only your own team can bid unless it lets you go. Ask for more (works about half the time; a team may walk away) or take a hometown discount (less money, one more year, more trust). Go to camp without choosing and your agent takes the biggest deal.</p>
<p><b>Raises and holdouts.</b> Clearly underpaid and past your rookie deal? Ask for a raise once a year. Turned down, you can hold out: you miss games until the team gives in or you report. Holding out costs trust.</p>
<p><b>Coach and front office.</b> Two scores show where you stand. The <b>front office</b> (0-100) is the general manager: it rises when you produce for your pay, win honors and meet your goals, and falls when you hold out, ask out or get turned down for a raise. It decides whether your team re-signs you and gives you a raise; below 20 they start shopping you. <b>Accept any role</b> builds both, but you can't ask to start again that season.</p>
<p><b>The coach's trust</b> (0-100) rises when you win, play well and meet your goals, and falls when you ask out, hold out or get turned down. With enough trust you can <b>ask to start</b>; it works best when you're close to the man ahead of you. A new team starts at 50.</p>
<p><b>Asking for a trade.</b> To a contender, somewhere you'd start, or anywhere. After two weeks your team shops you (before the deadline or in the offseason) and brings back up to three deals. Turn them down and it keeps looking. A team won't trade its best player on a long deal unless the relationship has broken down. The AI can still trade or cut you on its own.</p>
<p><b>Alerts</b> at the top of the Career tab: trades, releases, injuries, honors, milestones. <b>Season goals</b>: three targets set at kickoff; each one you meet builds trust and raises your next contract. <b>Awards race</b>: from week 7, where you'd finish if the season ended today.</p>
<p><b>Legacy.</b> Your career totals ranked against everyone who has played in this league at your position, your awards and Super Bowl rings, and a Hall of Fame meter. Our football data has real rosters but not real awards, so you're ranked against your league's history, not the real all-time list.</p>
<p><b>Earnings.</b> Your salary each season adds up to career earnings, shown on the Career tab.</p>
<p><b>Changing positions.</b> In the offseason or at camp you can move to a new spot: corner to safety or tackle to guard costs nothing (same position group); receiver to tight end or linebacker to defensive end costs a few points of overall. The list shows where you'd land on your team's depth chart. One cross-group move per offseason.</p>
<p><b>Retiring.</b> After the season, in the offseason or in camp. You get the voters' verdict right away (as of four years later) and any team that retires your jersey. Sim ahead to see the real vote. Your career can also end for you: a serious injury (more likely after 30), age (from 34, or 37 for quarterbacks and kickers; better players last longer), or no team wanting you. Nobody plays past 45.</p>
<p><b>Life after football.</b> Once retired you can join a coaching staff as a coordinator (offense if you played offense) and follow your coaching career as the years go by; winners get promoted. Or take over a front office: pick your old team or one of the worst teams, and this save becomes a GM league in the same history. Your separate GM league isn't touched.</p>` },
{ id: 'quick', title: 'Quick start', body: `
<ol>
<li><b>Pick a season and a team.</b> Any year from 1970 to 2026. After 1970, every team starts with its real roster for that year.</li>
<li><b>Choose a difficulty.</b> Rookie, Pro or All-Pro (see <a data-help="difficulty">Difficulty</a>).</li>
<li><b>Training camp.</b> Check the camp report on the Office tab, set your depth chart and schemes on the Coach tab, and cut down to the roster limit on the Roster tab (or tap Auto-cut).</li>
<li><b>Kick off.</b> On the Office tab, play one week at a time or sim to the playoffs. Before each game you can set a game plan.</li>
<li><b>During the season:</b> trade before the deadline (after week 9), handle injuries, place players on injured reserve, and answer trade offers.</li>
<li><b>Playoffs.</b> Play each round on the Office tab.</li>
<li><b>After the season:</b> awards, the Hall of Fame and the owner's verdict on your job. Then re-sign or let go of your expiring players.</li>
<li><b>The draft.</b> Scout prospects, then draft or let your scouts pick. AI teams may offer to trade up for your pick.</li>
<li><b>Free agency and the offseason.</b> Sign free agents, extend your stars, make trades.</li>
<li><b>Start the next season</b> and do it again. The league keeps changing with real history.</li>
</ol>
<p>Tap the <b>?</b> at the top of any screen to jump to its help.</p>` },

{ id: 'calendar', title: 'The season calendar', body: `
<p>Every season goes through the same phases. The header always shows where you are.</p>
<ul>
<li><b>Training camp (preseason).</b> Ratings change for the new year (the camp report). Rosters have to be cut to the limit before kickoff, and in a cap year you have to be under the cap.</li>
<li><b>Regular season.</b> 14 games through 1977, 16 from 1978 (9 in the 1982 strike year, 15 in 1987), 17 from 2021. The trade deadline is after week 9.</li>
<li><b>Playoffs.</b> 4 teams per conference through 1977, then 5, then 6 from 1990 and 7 from 2020 (8 in 1982).</li>
<li><b>Season complete.</b> Awards, All-Pro teams, Hall of Fame inductions, coaching changes and your owner's review. Your expiring contracts need a decision.</li>
<li><b>The draft.</b> 17 rounds through 1976, 12 through 1992, 8 in 1993, then 7.</li>
<li><b>Offseason.</b> Free agency, extensions, trades, retirements. Then tap "Start the next season."</li>
</ul>` },

{ id: 'office', title: 'Office tab', tab: 'home', body: `
<p>Your front office: what's happening now and what to do next.</p>
<ul>
<li><b>Main card.</b> The next action for this phase: kick off, play the week, sim to the playoffs, open the draft or start the next season.</li>
<li><b>Owner.</b> This season's goal and your job security (see <a data-help="owner">Owner and job security</a>).</li>
<li><b>Game plan.</b> Before each game: a scouting report on the opponent's schemes, the scheme matchup in points, a suggested counter, this week's offensive and defensive lean, and your starting quarterback. The plan applies to one game, then resets.</li>
<li><b>Camp report.</b> In training camp: who improved, who declined, who retired, and the league's biggest movers.</li>
<li><b>Holdouts.</b> Underpaid players who refuse to play (see <a data-help="morale">Morale and holdouts</a>).</li>
<li><b>Wire.</b> League news: trades, signings, injuries, awards, new schemes, expansion and more.</li>
<li><b>Your past games.</b> Box scores for every game you've played.</li>
</ul>` },

{ id: 'roster', title: 'Roster tab', tab: 'roster', body: `
<p>Every player on your team, by position. Sort by overall, potential or yearly salary, and filter by position with the chips.</p>
<ul>
<li><b>OVR</b> is how good he is today. <b>POT</b> is how good he can become. Each line also shows his jersey number, age, years in the league, morale, contract and season stats.</li>
<li><b>Colors:</b> gold is 85 and up (elite), green 72–84 (a good starter), plain 58–71 (average), grey under 58 (a backup).</li>
<li><b>Tap a player</b> to open his options: release, play hurt, injured reserve, extension, or shop him in trades.</li>
<li><b>Injuries</b> show as INJ with the weeks out. An injured starter can play hurt (at a ratings penalty), or you can place a player out several weeks on injured reserve to free his roster spot. Before 2012 IR is for the whole season. From 2012 one player a year can come back after 8 weeks, and from 2020 any number can after 4.</li>
<li><b>Cut-down.</b> You must be at or under the roster limit before kickoff: 40 through 1973, 47 in 1974, 43 through 1977, 45 through 1992, then 53. Auto-cut releases the lowest-value players.</li>
<li><b>Releasing</b> a player under contract can leave dead money (see <a data-help="money">Contracts, cap and budget</a>).</li>
</ul>` },

{ id: 'coach', title: 'Coach tab', tab: 'coach', body: `
<ul>
<li><b>Depth chart.</b> The order of starters and backups at each position. How many start at each position comes from your schemes (see <a data-help="schemes">Era schemes</a>). Move players up and down, sort by overall or potential, or reset to Auto (best healthy rating). Injured players are skipped automatically.</li>
<li><b>Offensive and defensive scheme.</b> Pick from the schemes that exist that season (see <a data-help="schemes">Era schemes</a>). Each shows how well your roster fits it.</li>
<li><b>Aggressiveness.</b> Higher means more fourth-down tries and deep shots: bigger wins and bigger losses.</li>
<li><b>Develop young starters.</b> Starters 26 and under who play most of the season get an extra development bump in the offseason.</li>
<li><b>Coaching staff.</b> Head coach, offensive and defensive coordinators. Their ratings add to your team. A coordinator whose preferred style matches your scheme gives his full boost. Coaches' ratings rise after good seasons and fall after bad ones. Other teams can hire your coordinators away to be head coaches. You can fire a coach and hire from the available pool. A few years after retiring, the smartest former players (quarterbacks, centers, linebackers and safeties most often) join the pool as coordinators, and the very best as head coaches. They start as middling coaches and rise with success.</li>
<li><b>Unit ratings.</b> Your offense, defense and every position group at a glance.</li>
</ul>` },

{ id: 'schemes', title: 'Era schemes', body: `
<p>Every offense and defense runs a named scheme that only exists in its era. The West Coast offense appears in 1979, the Run and Shoot from 1989 to 1997, the 46 Defense from 1984 to 1995, the Tampa 2 from 1996, and so on through RPO, wide-zone play-action and two-high quarters coverage.</p>
<ul>
<li><b>Fit.</b> Each scheme leans on different position groups. Power I needs a great back and line, Run and Shoot needs receivers, and Cover 3 needs a secondary. Fit shows how much better your current roster rates in that system.</li>
<li><b>Matchups.</b> Schemes beat some schemes and lose to others, like rock-paper-scissors. Quick passing beats blitz-heavy defenses, eight-man boxes stop the run but give up the deep ball, and two-high coverage takes away big plays but gets run on. No scheme is better on average.</li>
<li><b>New and old.</b> A brand-new scheme gives a bonus for a few years while defenses learn it. Once a third of the league runs one, opponents are ready for it. Schemes in their last years fade, and when one disappears, any team still running it switches.</li>
<li><b>Personnel.</b> Each scheme puts its own players on the field: Power I uses two backs and two tight ends, Run and Shoot four receivers and no tight end, Empty Five-Wide five receivers and no back; on defense the 3-4 uses four linebackers, the 46 eight in the box, Nickel five defensive backs, Dime six. Your depth chart starts that many at each position, so a four-receiver offense needs four good receivers, and the scheme's Fit accounts for your depth.</li>
<li><b>Families.</b> Every scheme is run-first, balanced or pass-first on offense, and bend-don't-break, balanced or pressure on defense. Your weekly game plan can lean a different way for one game.</li>
</ul>` },

{ id: 'fit', title: 'Team fit and chemistry', body: `
<p>The <b>Team fit</b> card at the top of the Coach tab grades how well your team suits its schemes, from A+ to F. It counts on the field: about −2 to +2 points a game.</p>
<ul>
<li><b>Personnel:</b> whether your players suit your schemes' formations and the positions they lean on. Four-receiver offenses need four good receivers.</li>
<li><b>Coaches:</b> whether your coordinators prefer the style of scheme you run.</li>
<li><b>Chemistry:</b> a new scheme costs about a point a game in its first season and a little in its second while it's installed. Keeping starters together from one season to the next adds a small bonus; turning over most of the lineup costs a little. AI teams pay the same costs, so they don't switch schemes on a whim.</li>
<li>Each scheme card shows the grade you'd have if you switched, including the installation cost. The Roster tab tags each player <b>Key</b> (a position your scheme leans on), <b>Starter</b>, <b>Depth</b> or <b>Not used</b>, with a <b>scheme fit grade</b>. Tap a player to see why: where he'd slot in your formation, whether your scheme leans on his position, and whether its style suits him. Free agents and players on the You receive side of a trade show the same fit grade for your team.</li>
<li>Free agents notice too: a player at a key position in your scheme likes you more, and one with no role in it likes you less.</li>
</ul>` },

{ id: 'moves', title: 'Moves tab: trades', tab: 'moves', body: `
<ul>
<li><b>Trade offers</b> at the top: offers AI teams sent you, plus offers from your trading block. Accept or reject. During the season they last a week; otherwise they last until kickoff.</li>
<li><b>Trade.</b> Pick a partner, or <b>All teams</b> to browse the whole league (picking a player or pick makes his team your partner), then tap players or picks under You send and You receive. Each side has its own position filter, you can sort by position, overall, potential or yearly salary (which then shows in place of age), and there's a search box for any player in the league. Picks for the next three drafts can be traded, and each shows its projected overall slot. Compensatory picks can't be traded.</li>
<li><b>How the AI values a deal.</b> Stars are worth far more than depth: two or three good players don't buy one great one, and a player who wouldn't make their roster is worth almost nothing to them. Age, potential and contract matter. On harder difficulties they ask for more.</li>
<li><b>Trading block.</b> Put players or picks in You send, choose what you want back (best offer, players, picks or young players) and a position you need, then tap Find offers. Up to five teams' best offers land in Trade offers.</li>
<li><b>Deadline.</b> No trades after week 9 until the season ends. In-season trades must keep both teams at or under the roster limit, and cap years must stay under the cap.</li>
</ul>` },

{ id: 'fa', title: 'Moves tab: contracts and free agency', body: `
<p>Free agency follows real NFL history, so it works differently by era.</p>
<ul>
<li><b>Through 1976 (Rozelle Rule).</b> Free agency barely exists: a team that signs another club's player owes compensation, so players stay put. Expiring contracts renew automatically unless you let a player go.</li>
<li><b>1977–1988.</b> Your expiring veterans are restricted. You can tender them, and other teams can send offer sheets you can match or let go for draft-pick compensation. You can send offer sheets too.</li>
<li><b>1989–1992 (Plan B).</b> Each team protects a set number of players. Everyone else becomes an unrestricted free agent.</li>
<li><b>1993 on (unrestricted free agency).</b> Veterans with expiring deals hit the open market. Free agency runs in rounds: you and AI teams bid salary and years, and the player weighs money, years, team quality, playing time, scheme fit and loyalty. Each free agent shows the offers other teams are expected to make this round (team, about how much, how many years), with the current leader marked; real bids land within a few percent. Once you bid, it tells you whether you're leading or what rank your offer is, judged the way the player judges it (money, years, team, playing time, fit and loyalty, not just salary). Your own expiring players show who would bid if they reach the market. Asking prices drop in later rounds.</li>
<li><b>Finding players.</b> The free agent market has its own position filter, sort (overall, potential, asking price, youngest) and name search right above the list.</li>
<li><b>Tags (1993 on).</b> Once a year each: the <b>franchise tag</b> keeps an expiring player for one year at the average of the top 5 salaries at his position (tagging him again costs 120% of last year's tag, a third time 144%). The <b>transition tag</b> is cheaper (top 10 average), but other teams can still sign him to an offer sheet when the market opens; match it or he leaves with no compensation.</li>
<li><b>Rookie contracts.</b> Since 2011 every drafted rookie signs a 4-year deal, and first-rounders carry a <b>fifth-year option</b>: before his fourth season, tap him on the Roster tab to pick it up (about his market value for year five) or decline it. From 1993 to 2010, first-rounders signed 5-year deals and second-rounders 4.</li>
<li><b>Re-signing.</b> Before free agency, decide on your expiring players: re-sign at his price, tag him (once a year, from 1993) or let him go.</li>
<li><b>Extensions.</b> Once unrestricted free agency exists (1993 on), you can extend a player in the last year of his contract, before he reaches the market.</li>
<li><b>In-season signings.</b> Unsigned players can be signed during the season if you have a roster spot.</li>
</ul>` },

{ id: 'money', title: 'Contracts, cap and budget', body: `
<ul>
<li><b>Salary cap from 1994.</b> It rises every year (2010 was uncapped) and grows about 7% a year after 2025. You can't kick off over the cap, and signings, re-signings, extensions and trades all have to fit.</li>
<li><b>Owner's budget before 1994 (and in 2010).</b> The owner caps your spending at 15% above the league's average payroll, a little more for big markets and after a playoff year. Re-signing your own players is always allowed, and your unsigned players count at their asking price until you let them go.</li>
<li><b>Dead money.</b> Releasing a player under contract leaves a quarter of what's left on his deal (at most 60% of one year's salary) on this year's payroll. Players on minimum-level deals cost nothing to cut.</li>
<li><b>Rookie contracts</b> are set by draft slot.</li>
<li>The payroll card on the Moves tab shows your payroll, the cap or budget, your room and any dead money.</li>
</ul>` },

{ id: 'ps', title: 'Practice squad', body: `
<ul>
<li>From 1989, every team has a practice squad: 5 players through 2003, 8 through 2013, 10 through 2019 and 16 from 2020.</li>
<li>Practice-squad players develop like everyone else but don't count against your roster limit, don't play and don't count against the cap.</li>
<li>Only players with two seasons or fewer qualify; from 2020, up to six veterans can too.</li>
<li>Add players from the Roster tab (tap a player, Move to practice squad) or from the free agent list. Promote them to the roster any time you have a spot.</li>
<li>During the season, other teams sign promising players off practice squads, including yours. You can do the same from the Moves tab (Other teams' practice squads).</li>
<li>A player who outgrows the practice squad moves to your roster at the start of the next season.</li>
</ul>` },

{ id: 'morale', title: 'Morale and holdouts', body: `
<ul>
<li>Every player has morale: Happy, Content, Unhappy or Angry. Winning and starting raise it. Losing lowers it, and so does sitting a good player on the bench.</li>
<li>Tap a player on the Roster tab to see what is driving his morale (record, playing time, pay).</li>
<li>From 1977, a good player (72+) who is paid under 65% of his market value and whose morale falls below 40 may <b>hold out</b>. The holdout card shows exactly why: his pay against his market value, his morale and what's behind it, and the new deal that ends it: he won't play until he gets a new deal. Holdouts appear on the Office tab. You can give him a new contract, wait (each week there's a small chance he reports anyway, angrier) or trade him.</li>
<li>Morale matters in free agency: happy players give their team a loyalty discount.</li>
</ul>` },

{ id: 'draft', title: 'The draft and scouting', body: `
<ul>
<li><b>Real draft classes.</b> Every class from 1971 on is the real one, with real names, positions and colleges. Your scouts only see a <b>scout grade</b>, based on where he was really drafted and his college, so there are steals and busts.</li>
<li><b>Draft class board</b> (League tab → Draft class). During the season, next year's class fills in as your scouts see more players each week, in random order. Sort it by position and grade.</li>
<li><b>Scouting visits.</b> You get 10 visits each draft to reveal a prospect's true potential. AI teams get 5, 10 or 15 depending on difficulty.</li>
<li><b>Draft tracker.</b> On draft day, every pick shows up as it's made, newest first, with the round, team, college, your scouts' grade and where he really went. Filter by round or team. Past drafts (the last 15) are under League → Draft results.</li>
<li><b>Draft day.</b> Draft when you're on the clock, sim to your next pick, let your scouts pick, or auto-draft the rest. AI teams may offer to trade up for your pick: accept or keep the pick. AI teams also trade picks with each other.</li>
<li><b>Compensatory picks</b> (from 1994): teams that lose more good free agents than they sign get up to 4 extra picks in rounds 3–7, placed at the end of the round. They can't be traded until 2017, when the NFL started allowing it.</li>
<li><b>Draft refusals</b> (before 2011): now and then a top-3 pick refuses to sign with a team coming off a bad season, as John Elway did in 1983, Bo Jackson in 1986 and Eli Manning in 2004. If it's your pick, trade his rights (he's in your trade list) or he sits out the season and re-enters the next draft. AI teams usually trade the rights for a future first-round pick.</li>
<li><b>After 2026</b> there are no real classes left, so new classes are generated.</li>
</ul>` },

{ id: 'ratings', title: 'How player ratings work', body: `
<ul>
<li><b>Real drafted players</b> are rated from their real careers (Pro-Football-Reference career value, Pro Bowls and All-Pros), with a little weight on draft slot and a small amount of luck. Active players' careers are projected forward, so a young star isn't judged on two seasons. Each position is scaled against its own peers, and 99 is reserved for the very best ever.</li>
<li><b>Undrafted players</b> (Kurt Warner, Tony Romo, Antonio Gates) are rated from how long they played, how often they started and their stats. Before 1999 there are no stats, so their ratings are rougher.</li>
<li><b>1970 rosters</b> are rated from the 1970 season.</li>
<li><b>Generated players</b> fill the few spots the real data can't.</li>
<li><b>Development.</b> Young players improve toward their potential, peak in their late 20s (quarterbacks, kickers and punters later) and decline after that. The camp report each preseason shows the changes.</li>
</ul>` },

{ id: 'real', title: 'Real careers and real rosters', body: `
<ul>
<li><b>Real careers</b> (on by default): real players rise, peak, fade and retire the year they really did. Turn it off on the new-league screen or the Data tab for random development and retirement and a different history every time.</li>
<li><b>Undrafted players</b> enter free agency in their real rookie year. Any team can sign them.</li>
<li><b>Real rosters</b> decide who is on which team when you start after 1970. From then on, AI teams make their own moves: nobody follows real trades.</li>
<li>Players still active in 2026 keep playing until the game's normal aging retires them.</li>
</ul>` },

{ id: 'history', title: 'NFL history in the game', body: `
<ul>
<li><b>Expansion:</b> Seattle and Tampa Bay (1976), Carolina and Jacksonville (1995), Cleveland returns (1999), Houston (2002). Each has a real expansion draft: you protect or expose players on the Moves tab the offseason before.</li>
<li><b>Moves and names:</b> the Raiders, Colts, Cardinals, Rams, Oilers/Titans, Browns/Ravens, Chargers and Washington all move or change names when they really did. The league realigns in 2002.</li>
<li><b>Strikes:</b> 1982 (a 9-game season and 16-team playoff) and 1987 (replacement players for three weeks).</li>
<li><b>Rules by era:</b> overtime from 1974, season length, playoff format, roster size, draft rounds, free agency rules and the salary cap all change when they really did.</li>
<li><b>Scoring</b> follows each season's real league averages for points and yards.</li>
</ul>` },

{ id: 'pages', title: 'Player and team pages', body: `
<ul>
<li><b>Player pages:</b> tap any player's name almost anywhere (stats, awards, Hall of Fame, the depth chart, trade lists, free agents, the draft tracker) or tap a player on the Roster tab and choose Player page. It shows his ratings, contract, fit with your team, awards and honors, every team he played for, his season-by-season stats with career totals, and his transactions (drafted, traded, signed, released, tagged, retired). A player on another team has a Trade for him button.</li>
<li><b>Team pages:</b> tap a team in the standings, on League → Teams, or tap your team's badge at the top of the screen. It shows the all-time record, playoff seasons and titles, former names, the current staff, schemes and best players, every season with its head coach (and the seasons you were GM), franchise leaders, award winners, Hall of Famers, the Ring of Honor and recent first-round picks.</li>
<li>Use Back to return to where you were.</li>
<li>Transactions and head coaches are recorded from this version on; earlier seasons show what was already saved.</li>
</ul>` },

{ id: 'play', title: 'Play the Game (preview)', body: `
<p>A first look at playing games yourself, Retro Bowl style. Open it from the game plan card on the Office tab (Play this game yourself). It uses your saved league: your team and this week's opponent, with their real players and ratings. The result doesn't count in your league yet.</p>
<ul>
<li><b>You play offense.</b> The other team's drives are simulated against your defense between yours.</li>
<li><b>Calling plays:</b> pick from six plays: quick slants, curl/flat, four verticals, a play-action shot, an inside run and an outside run. Your offensive scheme decides your personnel (how many backs, tight ends and receivers line up).</li>
<li><b>Landscape:</b> the game plays sideways, with your offense driving left to right. Turn your phone sideways (and turn off rotation lock).</li>
<li><b>Passing:</b> after the snap, touch anywhere and pull back to the left like a slingshot, then let go. The ball flies the opposite way; pull farther to throw farther, and pull up or down to aim across the field. Hold the ball too long and you get sacked. Tap Run to scramble.</li>
<li><b>Running:</b> your runner keeps going forward. Hold and slide your finger up or down to cut, slide back to retreat, tap to juke past a tackler, and tap Dive to fall forward.</li>
<li><b>Ratings matter:</b> better quarterbacks throw farther and more accurately, faster receivers get open, better cover men stay closer, and your line against their front decides how long you have to throw and how big the holes are.</li>
<li><b>Fourth down:</b> go for it, punt or try a field goal (the odds are shown). After a touchdown from 1994 on you can go for two.</li>
</ul>` },

{ id: 'weather', title: 'Stadiums and weather', body: `
<p>Every team plays in its real stadium for the era: Lambeau Field, the Astrodome, the Metrodome, Candlestick Park and so on, with its roof (open air, dome or retractable) and its city's climate.</p>
<ul><li>The next game card shows the stadium and the forecast; what you see is what you get.</li>
<li>Late-season games in cold cities get colder. Snow, wind and rain cut scoring and push teams to run more; snow and wind hurt most. Domes play a little faster.</li>
<li>Warm-weather and dome teams struggle a bit more in freezing games.</li>
<li>Retractable roofs close in bad weather. The Super Bowl is played in good conditions.</li>
<li>The weather shows in box scores and on the Games tab in a player career.</li></ul>` },
{ id: 'stats', title: 'Stats tab', tab: 'stats', body: `
<ul>
<li><b>Teams:</b> season team stats. <b>My players:</b> your players' season stats. <b>Careers:</b> career totals.</li>
<li><b>Awards:</b> MVP, Offensive and Defensive Player of the Year, Rookies of the Year and Super Bowl MVP for every season.</li>
<li><b>All-Pro:</b> first and second teams for every season.</li>
<li><b>Hall of Fame:</b> every inductee. Players become eligible about five years after they retire.</li>
<li><b>Records:</b> league records, Super Bowl champions and the <b>Ring of Honor</b>.</li>
</ul>` },

{ id: 'honors', title: 'Awards, Pro Bowl, Hall of Fame and Ring of Honor', body: `
<p><b>Pro Bowl.</b> When the regular season ends, each conference names a Pro Bowl squad (3 quarterbacks, 4 receivers, 4 corners and so on) from that season's stats. Pro Bowls count a little toward the Hall of Fame and show on player pages and the Stats tab (All-Pro &amp; Pro Bowl). Team pages also have a <b>record book</b>: single-season and career records with that franchise.</p>
<ul>
<li>Awards and All-Pro teams are voted on each season's stats and team success.</li>
<li>The Hall of Fame inducts a few retired players each year based on career value, awards and All-Pro selections, judged against their own position.</li>
<li><b>Ring of Honor:</b> retire the number of a former player of yours who earned it (Stats → Records). AI teams retire numbers for Hall of Famers with at least 4 seasons there, or 10+ season players who were stars.</li>
</ul>` },

{ id: 'league', title: 'League tab', tab: 'league', body: `
<ul>
<li><b>Standings</b> by division and conference, with playoff seeding.</li>
<li><b>Results:</b> every game, week by week, with box scores.</li>
<li><b>Leaders:</b> the league leaders in each stat.</li>
<li><b>Draft class:</b> next year's class as your scouts see it (see <a data-help="draft">The draft and scouting</a>).</li>
<li><b>Draft results:</b> every pick from the current draft and the last 15, filterable by round and team.</li>
<li><b>History:</b> past standings and playoff results.</li>
</ul>` },

{ id: 'owner', title: 'Owner and job security', body: `
<ul>
<li>Each season the owner sets a goal based on how your roster ranks: from "win more games" up to "reach the conference championship."</li>
<li>Meeting or beating the goal raises your job security, and missing it lowers it. Winning the Super Bowl helps a lot.</li>
<li>If your job security runs out, you're fired. Other teams make offers, and you can take a new job (with that team's roster) or start a new league.</li>
</ul>` },

{ id: 'difficulty', title: 'Difficulty', body: `
<ul>
<li><b>Rookie:</b> AI teams take cheaper trades and make generous offers, scout less (5 visits), adjust their schemes less often, and your team gets a small boost.</li>
<li><b>Pro:</b> balanced. Fair trades, 10 visits each.</li>
<li><b>All-Pro:</b> AI teams want more in trades and offer less, scout more (15 visits), your team plays at a small disadvantage, and opposing coaches adjust their game plans to counter yours.</li>
<li>You can change difficulty any time on the Data tab.</li>
</ul>` },

{ id: 'data', title: 'Data tab: saving, backups and updates', tab: 'data', body: `
<ul>
<li><b>Saving is automatic</b> and stays on this device. If a save ever fails, a red warning appears on every screen. Download a backup right away.</li>
<li><b>Backups:</b> Download backup saves your league as a file, and Restore loads one. Use it to move a league to another device or keep a safe copy. <b>Deleting the game's Home Screen icon deletes its saved data</b>, so back up first.</li>
<li><b>Updates</b> arrive by themselves when you open the game online. If you don't see a new version, close the game fully and reopen it. The version is at the bottom of the Data tab.</li>
<li><b>Offline:</b> after one visit online, everything works offline.</li>
<li><b>Importing data:</b> paste Pro-Football-Reference tables for a 1970 roster or a draft class (type 1984s for the 1984 supplemental draft). Data packs share imports with a friend.</li>
<li><b>Real careers</b> and <b>difficulty</b> settings for your current league live here too.</li>
</ul>` },

{ id: 'tips', title: 'Tips and common questions', body: `
<ul>
<li><b>My team is bad. Where do I start?</b> Trade veterans for picks and young players, give young starters playing time with "Develop young starters," and draft for potential.</li>
<li><b>Why won't the AI take my trade?</b> Quantity doesn't buy quality, and they won't take players who wouldn't make their roster. Try the trading block to see what the league will really pay.</li>
<li><b>Why did a player's rating drop?</b> Age, or his real career (with Real careers on). Check the camp report.</li>
<li><b>Can't kick off?</b> You're over the roster limit (cut players) or over the cap (release or trade salary).</li>
<li><b>How do I get my coordinator's full boost?</b> Run a scheme of the style he prefers.</li>
<li><b>Where are the old draft picks?</b> Only the next three drafts can be traded. Leagues that start after 1970 skip earlier drafts.</li>
<li><b>Can friends play?</b> Yes. Send them the link and have them add it to the Home Screen. Every device has its own league.</li>
</ul>` }
];
const HELP_FOR_TAB = { home: 'office', roster: 'roster', stats: 'stats', league: 'league', moves: 'moves', coach: 'coach', data: 'data' };
