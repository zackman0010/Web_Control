#!/bin/bash
dir_base="$( dirname "${BASH_SOURCE[0]}" )";
cd "$dir_base";
#put all recieved arguments into an $args[index] array
args=("$@");

function sanitize() {
	# first, strip underscores
	local work="$1"
	work=${work//_/}
	# next, replace spaces with underscores
	work=${work// /_}
	# now, clean out anything that's not alphanumeric or an underscore
	work=${work//[^a-zA-Z0-9_]/}
	# finally, lowercase with TR
	clean=`echo -n $work | tr A-Z a-z`
}
#global way to get status of server.
function get_status() {
	local work="$1"
	check=$(sudo -u www-data screen -ls | grep $work | awk '$1=$1');
	#ps auxw|grep -i screen|grep -v grep | awk '{ s = ""; for (i = 11; i <= NF; i++) s = s $i " "; print $1,$2,$9, s }'
}

for dir in `ls -d */ | sed 's|/||'`; do
	sanitize "$dir"
	if [ "$clean" == "${args[0]}" ]; then
		server="$clean";
	fi
done

if [ -z "$server" ]; then
	echo "Error in input";
else
	var_cont=true;
	################################
	#### Remove this when ready
	################################
	#server="factorio"
	dir_server="$dir_base/$server";
	#echo "$dir_server"
	#important files
	#config/config.ini
	if [ ! -e "$dir_server/config/config.ini" ]; then
		echo "Missing config.ini"; var_cont=false;
	else
		port=$(grep "port=" $dir_server/config/config.ini | grep -o -E '[0-9]+')
	fi
	#server_settings.ini
	if [ ! -e "$dir_server/server-settings.json" ]; then echo "Missing server-settings.json"; var_cont=false; fi
	#player_data.json
	if [ ! -e "$dir_server/player-data.json" ]; then echo "Missing player-data.json"; var_cont=false; fi
	#banlist.json
	if [ ! -e "$dir_server/banlist.json" ]; then echo "Missing banlist.json"; var_cont=false; fi
	if [ -z "$port" ]; then echo "Port is incorrectly configured in config.ini"; fi
	#saves/
	sanitize "${args[2]}"
	cur_user="$clean"
	sanitize "${args[1]}"
	cd $dir_server
	case "$clean" in
	    'prestart')
			get_status "$server"
			if [ "$check" ]; then 
				#server is running
				echo "true" ;
			else
				#server is stopped
				echo "false";
			fi
            ;;
        'start')
			get_status "$server"
			if [ "$check" ]; then 
				echo -e "Attempted Start by $cur_user: Server is already running\n\n" >> $dir_server/screenlog.0 ;
			else
				if [ "$var_cont" = false ] ; then
					echo "Cannot start server";
				else
					echo -e "Starting Server. Initiated by $cur_user\n\n" >> $dir_server/screenlog.0 ;
					if [ -e "$dir_server/screenlog.0" ]; then
						LASTDATA=$(tail -n 50 $dir_server/screenlog.0)
						echo "${LASTDATA}" > $dir_server/screenlog.0 ;
					fi
					
					#echo "Server under going Updates...";
					#exit
					sudo -u www-data /usr/bin/screen -d -m -L -S $server /usr/share/factorio/bin/x64/factorio --start-server-load-latest --port $port -c $dir_server/config/config.ini --server-setting $dir_server/server-settings.json
					sudo -u www-data /usr/bin/screen -r $server -X colon "log on^M"
					sudo -u www-data /usr/bin/screen -r $server -X colon "logfile filename screenlog.0^M"
					sudo -u www-data /usr/bin/screen -r $server -X colon "logfile flush 0^M"
					sudo -u www-data /usr/bin/screen -r $server -X colon "multiuser on^M"
					sudo -u www-data /usr/bin/screen -r $server -X colon "acladd root^M"
					sudo -u www-data /usr/bin/screen -r $server -X colon "acladd user^M"
				fi
			fi
            ;;
         
        'stop')
			get_status "$server"
			if [ "$check" ]; then 
				#echo "Server Shuttind Down" ;
				echo -e "Server Shutting Down. Initiated by $cur_user\n\n" >> screenlog.0 ;
				sudo -u www-data /usr/bin/screen -S $server -X at 0 stuff ^C
			else
				echo "Server is already Stopped.";
			fi
            ;;
         
        'status')
			get_status "$server"
			if [ "$check" ]; then 
				echo -e "${check}"
				echo "Server is Running" ;
			else
				echo "Server is Stopped";
			fi
            ;;

        *)
            echo $"Usage: $0 server_select {start|stop|status} user"
            exit 1
	esac
fi