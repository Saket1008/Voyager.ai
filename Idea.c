#include <stdio.h>
#include <stdlib.h>

int main() {
    int count, start, i, j, direction;
    printf("Enter the number of disk requests:\n");
    scanf("%d", &count);
    int tracks[count];
    printf("Enter the track numbers (space separated):\n");
    for(i=0; i<count; i++) scanf("%d", &tracks[i]);
    printf("Enter the initial head position:\n");
    scanf("%d", &start);
    printf("Enter direction (1 for right, 0 for left):\n");
    scanf("%d", &direction);



   
    for(i=0;i<count-1;i++){
        for(j=i+1;j<count;j++){
            if(tracks[i]>tracks[j]){
                int t=tracks[i];
                tracks[i]=tracks[j];
                tracks[j]=t;
            }
        }
    }

    int idx=0;
    for(i=0;i<count;i++){
        if(start<tracks[i]){
            idx=i;
            break;
        }
    }

    int total_seek=0;
    int current=start;
    printf("\nRequest Sequence\tHead Movement\n");

    if(direction==1){
        for(i=idx;i<count;i++){
            printf("%d\t\t\t%d\n", tracks[i], abs(current-tracks[i]));
            total_seek += abs(current-tracks[i]);
            current = tracks[i];
        }
        for(i=idx-1;i>=0;i--){
            printf("%d\t\t\t%d\n", tracks[i], abs(current-tracks[i]));
            total_seek += abs(current-tracks[i]);
            current = tracks[i];
        }
    } else {
        for(i=idx-1;i>=0;i--){
            printf("%d\t\t\t%d\n", tracks[i], abs(current-tracks[i]));
            total_seek += abs(current-tracks[i]);
            current = tracks[i];
        }
        for(i=idx;i<count;i++){
            printf("%d\t\t\t%d\n", tracks[i], abs(current-tracks[i]));
            total_seek += abs(current-tracks[i]);
            current = tracks[i];
        }
    }

    printf("\nTotal Seek Time: %d\n", total_seek);
    printf("Average Seek Time: %.2f\n", (float)total_seek / count);
    return 0;
}
