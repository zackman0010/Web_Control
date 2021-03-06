#!/bin/bash
result=("${PWD##*/}");
#use master repo by default. If subfolder is a branch that exists, we'll use that branch repo instead (example: beta)
if [ "$result" == "html" ]; then
	result="master";
fi
#args contains which number php is commanding to work on
#we do this in steps in hopes that php can flush it's output, so we cna view each step taking place.
args=("$@");
tmp_dir="/tmp";

if [ "${args[0]}" ]; then
	case "${args[0]}" in
		'count')
			#ensure total number of steps is echoed here! PHP uses this to know how many times to loop		
			echo "6"
			exit 1
			;;

		'1')
			printf "Detected \"$result\" branch \r\n";
			printf "Step ${args[0]} - Downloading latest updates \r\n";
			#wget -q https://github.com/factoriommo/Web_Control/archive/$result.zip -O $tmp_dir/$result.zip
			wget -t 1 -T 5 https://github.com/factoriommo/Web_Control/archive/$result.zip -O $tmp_dir/$result.zip && wget_result=true || wget_result=false
			#wget -t 1 -T 5 https://gitlab.com/factoriommo/Web_Control/repository/archive.zip?ref=$result -O $tmp_dir/$result.zip && wget_result=true || wget_result=false
			if [ "$wget_result" = true ]; then
					printf "Download Completed \r\n"
			else
					printf "Download Failed. Halting update \r\n"
					exit
			fi
			printf "\r\n-----------\r\n\r\n";
			;;

		'2')
			printf "Step ${args[0]} - Unzipping updates \r\n";
			unzip -u $tmp_dir/$result.zip -d $tmp_dir/
			printf "\r\n-----------\r\n\r\n";
			;;

		'3')
			printf "Step ${args[0]} - Updating files \r\n";
			rsync -a -v $tmp_dir/Web_Control-$result/html/* ./
			rsync -a -v $tmp_dir/Web_Control-$result/factorio/manage.c /var/www/factorio/
			rsync -a -v $tmp_dir/Web_Control-$result/factorio/manage.sh /var/www/factorio/
			rsync -a -v $tmp_dir/Web_Control-$result/factorio/3RaFactorioBot.js /var/www/factorio/
			printf "\r\n-----------\r\n\r\n";
			;;

		'4')
			printf "Step ${args[0]} - Compiling updated manage.c \r\n";
			gcc -o /var/www/factorio/managepgm -std=gnu99 -pthread /var/www/factorio/manage.c
			printf "\r\n-----------\r\n\r\n";
			;;

		'5')
			printf "Step ${args[0]} - Deleting temporary files \r\n";
			rm -Rf $tmp_dir/$result.zip $tmp_dir/Web_Control-$result/
			printf "\r\n-----------\r\n\r\n";
			;;

		'6')
			printf "Step ${args[0]} - forcing file permissions to www-data user \r\n";
			sudo chown -R www-data:www-data /var/www/
			sudo chown -R www-data:www-data /usr/share/factorio/
			;;

		*)
			printf "Error in input provided\r\n"
			exit 1
	esac
else
	printf "No input provided\r\n"
fi
